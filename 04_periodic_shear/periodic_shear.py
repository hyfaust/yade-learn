# -*- coding: utf-8 -*-
"""
周期性简单剪切试验（Periodic Simple Shear Test）- YADE 离散元模拟
=================================================================

本脚本使用周期性边界条件模拟颗粒材料的简单剪切行为。
- 周期性边界：消除边界效应，模拟无限大均匀介质
- 简单剪切：通过操纵 O.cell.hSize 施加剪切变形
- 数据采集：记录剪应力-剪应变曲线和体积变化

运行方式：
    yadedaily periodic_shear.py
"""

# ============================================================
# 导入必要的 YADE 模块
# ============================================================
from yade import pack, plot, utils, qt
from yade.utils import Vector3, Matrix3
import numpy as np
import math

# ============================================================
# 模拟参数定义
# ============================================================

# --- 颗粒材料参数 ---
young = 5e6           # 杨氏模量 [Pa]
poisson = 0.3         # 泊松比
frictionAngle = 0.5   # 颗粒间摩擦角 [rad]（约 28.6°）
density = 2600        # 颗粒密度 [kg/m³]

# --- 周期性盒子参数 ---
boxSize = 0.01        # 盒子边长 [m]（立方体盒子）
numSpheres = 400       # 颗粒数量
rMean = 0.0005        # 颗粒平均半径 [m]
rRelFuzz = 0.3        # 半径相对分散度

# --- 剪切参数 ---
strainRate = 1.0      # 剪切应变速率 [1/s]
maxShearStrain = 0.3  # 最大剪切应变
loadingDirection = 1  # 加载方向：1=xy剪切，-1=yx剪切

# --- 阻尼参数 ---
dampingCoeff = 0.2    # 局部阻尼系数

# --- 数据采集参数 ---
dataInterval = 200    # 数据采集间隔（每 N 步采集一次）

# ============================================================
# 启用周期性边界条件
# ============================================================

# 设置 O.periodic = True 启用周期性边界
# 在此模式下，模拟盒子在各方向无限重复
O.periodic = True

# 设置盒子的参考尺寸（初始尺寸）
# 这是一个立方体盒子，边长为 boxSize
O.cell.refSize = Vector3(boxSize, boxSize, boxSize)

# ============================================================
# 材料定义
# ============================================================

# 定义摩擦材料
# - frictionAngle 控制颗粒间的摩擦行为
# - 在周期性剪切中，摩擦角直接影响剪胀角和临界应力比
O.materials.append(FrictMat(
    young=young,
    poisson=poisson,
    frictionAngle=frictionAngle,
    density=density
))

# ============================================================
# 生成周期性球体堆积
# ============================================================

# 使用 SpherePack 的 makeCloud 方法生成周期性随机堆积
# periodic=True 确保颗粒在周期性盒子内均匀分布
sp = pack.SpherePack()
sp.makeCloud(
    (0, 0, 0),                           # 区域最小角点
    (boxSize, boxSize, boxSize),          # 区域最大角点
    rMean=rMean,                          # 平均半径
    rRelFuzz=rRelFuzz,                    # 半径分散度
    num=numSpheres,                       # 颗粒数量
    periodic=True                         # 周期性边界！
)

# 将颗粒添加到模拟中
sphereIds = sp.toSimulation()

# 计算初始孔隙率
# 盒子体积
V_box = boxSize**3
# 颗粒总体积
V_spheres = sum(
    (4.0/3.0) * math.pi * O.bodies[i].shape.radius**3
    for i in sphereIds
    if O.bodies[i] is not None and isinstance(O.bodies[i].shape, Sphere)
)
# 初始孔隙率 = 1 - 颗粒体积 / 盒子体积
initialPorosity = 1.0 - V_spheres / V_box
print(f"已生成 {len(sphereIds)} 个颗粒")
print(f"初始孔隙率: {initialPorosity:.4f}")

# 记录初始盒子体积（用于计算体积应变）
initialVolume = O.cell.refSize[0] * O.cell.refSize[1] * O.cell.refSize[2]

# ============================================================
# 引擎设置（O.engines）
# ============================================================

O.engines = [
    # 1. 力重置器
    ForceResetter(),

    # 2. 碰撞检测器
    # 周期性模拟中只需要球体的包围盒，不需要墙
    InsertionSortCollider([Bo1_Sphere_Aabb()]),

    # 3. 相互作用循环
    # 注意：周期性模拟中使用 ScGeom 处理跨越边界的接触
    InteractionLoop(
        [Ig2_Sphere_Sphere_ScGeom()],            # 球-球接触几何
        [Ip2_FrictMat_FrictMat_FrictPhys()],      # 摩擦材料接触物理
        [Law2_ScGeom_FrictPhys_CundallStrack()]   # Cundall-Strack 本构
    ),

    # 4. 牛顿积分器
    # 周期性模拟中，颗粒运动自动满足周期性条件
    NewtonIntegrator(damping=dampingCoeff),

    # 5. 数据采集
    PyRunner(iterPeriod=dataInterval, command='collectData()'),

    # 6. 剪切加载控制
    PyRunner(iterPeriod=1, command='applyShear()'),

    # 7. 状态监控
    PyRunner(iterPeriod=2000, command='printStatus()'),
]

# ============================================================
# 剪切加载函数
# ============================================================

# 全局变量：累计剪切应变和模拟阶段
globalShearStrain = 0.0
simulationPhase = 'compression'  # 'compression' 或 'shear'

def applyShear():
    """
    施加简单剪切变形。
    仅在剪切阶段（simulationPhase == 'shear'）执行。
    """
    global globalShearStrain

    # 仅在剪切阶段执行
    if simulationPhase != 'shear':
        return

    # 计算每步的剪切应变增量
    # dΓ = strainRate × dt
    dGamma = strainRate * O.dt

    # 累计剪切应变
    globalShearStrain += dGamma

    # 修改 hSize 矩阵的 xy 分量
    # 注意：O.cell.hSize 返回副本，必须整体赋值
    h = O.cell.hSize
    h[0, 1] += dGamma * O.cell.refSize[1]
    O.cell.hSize = h

    # 达到最大应变时停止
    if globalShearStrain >= maxShearStrain:
        print(f"\n=== 达到最大剪切应变 {maxShearStrain:.2f}，模拟结束 ===")
        O.pause()


# ============================================================
# 数据采集函数
# ============================================================

def collectData():
    """
    采集并记录剪切过程中的力学数据。
    仅在剪切阶段执行。
    """
    if simulationPhase != 'shear':
        return

    global globalShearStrain

    # --- 应力测量 ---
    # 获取宏观应力张量（基于接触力的统计平均）
    # 周期性模拟使用 stressTensorOfPeriodicCell()
    stressTensor = utils.stressTensorOfPeriodicCell()

    # 提取应力分量
    sigma_xx = stressTensor[0, 0]
    sigma_yy = stressTensor[1, 1]
    sigma_zz = stressTensor[2, 2]
    tau_xy = stressTensor[0, 1]     # 剪应力分量

    # 计算应力不变量
    # 平均应力 p（球应力）
    meanStress = (sigma_xx + sigma_yy + sigma_zz) / 3.0

    # 偏应力 q（von Mises 应力）
    # q = sqrt(3 * J2)，其中 J2 是偏应力第二不变量
    dev_xx = sigma_xx - meanStress
    dev_yy = sigma_yy - meanStress
    dev_zz = sigma_zz - meanStress
    J2 = 0.5 * (dev_xx**2 + dev_yy**2 + dev_zz**2) + tau_xy**2
    devStress = math.sqrt(3.0 * J2) if J2 > 0 else 0.0

    # --- 应变测量 ---
    # 剪切应变：hSize[0,1] / refSize[1]
    shearStrain = O.cell.hSize[0, 1] / O.cell.refSize[1]

    # --- 体积变化 ---
    # 当前盒子体积
    currentVolume = O.cell.hSize.determinant()
    # 体积应变（正值表示体积增大）
    volStrain = (currentVolume - initialVolume) / initialVolume

    # --- 孔隙率 ---
    currentPorosity = 1.0 - V_spheres / currentVolume

    # --- 配位数 ---
    coordNum = computeCoordinationNumber()

    # --- 应力比 ---
    # 应力比 η = τ_xy / σ_yy（简单剪切中的主要应力比）
    if abs(meanStress) > 1e-3:
        stressRatio = tau_xy / abs(meanStress)
    else:
        stressRatio = 0.0

    # 记录数据
    plot.addData(
        iter=O.iter,
        shearStrain=shearStrain,       # 剪切应变 γ
        tau_xy=tau_xy,                  # 剪应力 [Pa]
        meanStress=meanStress,          # 平均应力 [Pa]
        devStress=devStress,            # 偏应力 [Pa]
        stressRatio=stressRatio,        # 应力比
        volStrain=volStrain,            # 体积应变
        porosity=currentPorosity,       # 孔隙率
        coordNum=coordNum,              # 配位数
        sigma_xx=sigma_xx,
        sigma_yy=sigma_yy,
        sigma_zz=sigma_zz,
        unbalanced=utils.unbalancedForce(),
    )


def computeCoordinationNumber():
    """
    计算配位数（Coordination Number）。

    配位数 Z = 2 × 实际接触数 / 颗粒数
    对于稳定堆积，Z 通常在 4 ~ 7 之间。
    在剪切过程中，配位数会随密度变化而改变。
    """
    totalContacts = 0
    totalSpheres = 0

    for i in sphereIds:
        b = O.bodies[i]
        if b is None or not isinstance(b.shape, Sphere):
            continue
        totalSpheres += 1
        for inter in b.intrs():
            if inter.isReal:
                totalContacts += 1

    # 每个接触被两个颗粒共享
    if totalSpheres > 0:
        return totalContacts / totalSpheres
    return 0.0


# ============================================================
# 状态监控函数
# ============================================================

def printStatus():
    """
    定期打印模拟状态信息。
    """
    if simulationPhase != 'shear':
        return
    shearStrain = O.cell.hSize[0, 1] / O.cell.refSize[1]
    currentVolume = O.cell.hSize.determinant()
    volStrain = (currentVolume - initialVolume) / initialVolume
    unbal = utils.unbalancedForce()

    print(f"步数: {O.iter:>8d} | "
          f"剪应变: {shearStrain:>8.4f} | "
          f"体应变: {volStrain:>10.6f} | "
          f"不平衡力: {unbal:>8.4f}")


# ============================================================
# 绘图设置
# ============================================================

# 定义绘图数据
plot.plots = {
    # 图 1：剪应力 vs 剪应变
    'shearStrain': ('tau_xy',),

    # 图 2：体积应变 vs 剪应变
    'shearStrain ': ('volStrain',),

    # 图 3：应力比 vs 剪应变
    'shearStrain  ': ('stressRatio',),

    # 图 4：配位数 vs 剪应变
    'shearStrain   ': ('coordNum',),
}

# 重置绘图数据
plot.resetData()

# ============================================================
# 设置时间步并运行
# ============================================================

# 使用 P 波时间步估算器设置安全的时间步长
O.dt = PWaveTimeStep()

print("=" * 60)
print("周期性简单剪切试验")
print("=" * 60)
print(f"盒子尺寸: {boxSize*1000:.1f} × {boxSize*1000:.1f} × {boxSize*1000:.1f} mm")
print(f"颗粒数量: {len(sphereIds)}")
print(f"平均半径: {rMean*1000:.3f} mm")
print(f"初始孔隙率: {initialPorosity:.4f}")
print(f"剪切应变速率: {strainRate:.1f} 1/s")
print(f"最大剪切应变: {maxShearStrain:.2f}")
print(f"时间步长: {O.dt:.6e} s")
print("=" * 60)

# ============================================================
# 阶段 0：各向同性压缩（建立接触网络）
# ============================================================
# 周期性模拟中没有重力，颗粒初始呈"气态"（无接触）
# 必须先缩小盒子让颗粒互相接触，形成稳定的接触网络

print("\n=== 阶段 0：各向同性压缩 ===")
print("正在压缩颗粒...")

# 使用 O.step() 循环进行渐进式压缩
# 每步缩小盒子一点点，同时运行一步模拟
targetRatio = 0.75  # 目标：缩小到 75%（温和压缩，避免过度重叠）
currentRatio = 1.0
step = 0

while currentRatio > targetRatio:
    # 缩小盒子 0.1%
    h = O.cell.hSize
    h[0, 0] *= 0.999
    h[1, 1] *= 0.999
    h[2, 2] *= 0.999
    O.cell.hSize = h
    currentRatio *= 0.999

    # 运行一步
    O.step()
    step += 1

    # 每 500 步打印状态
    if step % 500 == 0:
        numContacts = sum(1 for i in O.interactions if i.isReal)
        print(f"  步 {step}: 盒子 {O.cell.hSize[0,0]*1000:.2f}mm, "
              f"接触数 {numContacts}")

        # 如果有足够的接触，提前结束
        if numContacts > 300:
            print(f"  已有足够接触 ({numContacts})，停止压缩")
            break

# 运行更多步让系统稳定
print("稳定中...")
for _ in range(1000):
    O.step()

# 检查结果
unbal = utils.unbalancedForce()
numContacts = sum(1 for i in O.interactions if i.isReal)
print(f"压缩完成！")
print(f"  不平衡力: {unbal:.4f}" if not math.isnan(unbal) else "  压缩完成")
print(f"  接触数: {numContacts}")
print(f"  盒子尺寸: {O.cell.hSize[0,0]*1000:.2f} × {O.cell.hSize[1,1]*1000:.2f} × {O.cell.hSize[2,2]*1000:.2f} mm")

# 记录压缩后的初始状态
initialVolume = O.cell.hSize.determinant()
initialPorosity_post = 1.0 - V_spheres / initialVolume
print(f"压缩后孔隙率: {initialPorosity_post:.4f}")

# 重置数据（压缩阶段的数据不需要）
plot.resetData()

# 切换到剪切阶段
simulationPhase = 'shear'

print("\n=== 阶段 1：简单剪切加载 ===")
print(f"开始剪切，目标应变: {maxShearStrain:.2f}")

# ============================================================
# 运行模拟
# ============================================================

# 运行模拟，applyShear() 函数会自动在达到最大应变时暂停
O.run()
import time
while O.running:
    time.sleep(0.5)

print("模拟完成！")

# ============================================================
# 模拟结束后的后处理（在 Python 交互环境中执行）
# ============================================================

# 取消以下注释以保存数据和绘制结果图：

# # 保存数据到文件
# plot.saveGnuplot('/tmp/periodic_shear_data')
#
# # 使用 matplotlib 绘制结果
# import matplotlib.pyplot as plt
#
# fig, axes = plt.subplots(2, 2, figsize=(12, 10))
#
# # 图 1：剪应力-剪应变曲线
# ax1 = axes[0, 0]
# ax1.plot(plot.data['shearStrain'], plot.data['tau_xy'], 'b-', linewidth=1.5)
# ax1.set_xlabel('剪应变 γ')
# ax1.set_ylabel('剪应力 τ_xy [Pa]')
# ax1.set_title('剪应力-剪应变曲线')
# ax1.grid(True)
#
# # 图 2：体积应变-剪应变曲线
# ax2 = axes[0, 1]
# ax2.plot(plot.data['shearStrain'], plot.data['volStrain'], 'r-', linewidth=1.5)
# ax2.set_xlabel('剪应变 γ')
# ax2.set_ylabel('体积应变 ε_v')
# ax2.set_title('体积应变曲线（剪胀/剪缩）')
# ax2.axhline(y=0, color='k', linestyle='--', alpha=0.3)
# ax2.grid(True)
#
# # 图 3：应力比-剪应变曲线
# ax3 = axes[1, 0]
# ax3.plot(plot.data['shearStrain'], plot.data['stressRatio'], 'g-', linewidth=1.5)
# ax3.set_xlabel('剪应变 γ')
# ax3.set_ylabel('应力比 τ/σ_mean')
# ax3.set_title('应力比演化')
# ax3.grid(True)
#
# # 图 4：孔隙率-剪应变曲线
# ax4 = axes[1, 1]
# ax4.plot(plot.data['shearStrain'], plot.data['porosity'], 'm-', linewidth=1.5)
# ax4.set_xlabel('剪应变 γ')
# ax4.set_ylabel('孔隙率 e')
# ax4.set_title('孔隙率演化')
# ax4.grid(True)
#
# plt.tight_layout()
# plt.savefig('/tmp/periodic_shear_results.png', dpi=150)
# plt.show()

quit()

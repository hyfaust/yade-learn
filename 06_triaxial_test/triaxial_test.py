# -*- coding: utf-8 -*-
"""
三轴试验（Triaxial Test）- YADE 周期性边界离散元模拟
=====================================================

本脚本使用周期性边界条件和 PeriTriaxController 模拟完整的三轴试验：
  阶段 0：各向同性压缩 —— 直接缩小盒子建立接触网络（PeriTriaxController 需要初始接触）
  阶段 1：各向同性固结 —— 三方向施加相同围压，使试样达到力学平衡
  阶段 2：偏应力加载 —— 保持围压不变，增大轴向应力直至破坏

记录数据：
  - 应力-应变曲线 (q vs ε_a)
  - 体变曲线 (ε_v vs ε_a)
  - p-q 应力路径
  - 孔隙率演化

运行方式：
    yadedaily triaxial_test.py
"""

# ============================================================
# 导入模块
# ============================================================
from yade import pack, plot, utils, qt
from yade.utils import Vector3
import math

# ============================================================
# 试验参数定义
# ============================================================

# --- 材料参数 ---
young = 5e6            # 杨氏模量 [Pa]，颗粒接触刚度
poisson = 0.3          # 泊松比，影响法向/切向刚度比
frictionAngle = 0.524  # 颗粒间摩擦角 [rad]（约 30°）
density = 2600         # 颗粒密度 [kg/m³]，典型砂土值

# --- 围压 ---
# 不同围压下试样的力学响应不同（围压越大，峰值强度越高）
confiningPressure = 100e3  # 围压 [Pa]，100 kPa（约 1 个大气压）

# --- 试样几何 ---
side = 0.01            # 周期性盒子边长 [m]（立方体）
numSpheres = 400        # 颗粒数量（减小以避免颗粒溢出盒子）
rMean = 0.0005          # 颗粒平均半径 [m]（0.5 mm）
rRelFuzz = 0.3          # 半径相对分散度（0=等径，越大越分散）

# --- 加载控制参数 ---
strainRate = 10.0       # 加载阶段 yy 方向的应变速率 [1/s]
                        # 注意：周期性模拟中应变速率应足够快以节省计算时间
                        # 但不能太快以避免动态效应

# --- 收敛判据 ---
maxUnbalanced = 0.05    # 最大不平衡力阈值（越小越精确，但越慢）

# --- 阻尼参数 ---
dampingCoeff = 0.2      # 局部阻尼系数

# --- 数据采集参数 ---
dataInterval = 200       # 数据采集间隔（每 N 步采集一次）
vtkInterval = 2000       # VTK 输出间隔

# ============================================================
# 启用周期性边界
# ============================================================

# 设置周期性边界条件
# 在此模式下，模拟盒子在三个方向无限重复，没有墙壁
O.periodic = True

# 设置参考盒子尺寸（立方体）
O.cell.setBox(Vector3(side, side, side))

# ============================================================
# 材料定义
# ============================================================

# FrictMat 是最基础的摩擦材料模型
# 在三轴试验中，frictionAngle 决定了颗粒间的抗剪强度
O.materials.append(FrictMat(
    young=young,
    poisson=poisson,
    frictionAngle=frictionAngle,
    density=density
))

# ============================================================
# 生成周期性球体堆积
# ============================================================

# 使用 makeCloud 在周期性盒子内生成随机球体
# periodic=True 保证颗粒在边界处不会被截断
sp = pack.SpherePack()
sp.makeCloud(
    minCorner=Vector3(0, 0, 0),             # 区域最小角点
    maxCorner=Vector3(side, side, side),    # 区域最大角点
    rMean=rMean,                            # 平均半径
    rRelFuzz=rRelFuzz,                      # 半径分散度
    num=numSpheres,                         # 颗粒数量
    periodic=True                           # 周期性边界
)

# 将颗粒添加到仿真中
sphereIds = sp.toSimulation()

print(f"已生成 {len(sphereIds)} 个颗粒")

# ============================================================
# 计算初始孔隙率
# ============================================================

def computePorosity():
    """
    计算当前孔隙率。
    孔隙率 n = 1 - V_spheres / V_box
    """
    # 计算所有颗粒的总体积
    volSpheres = sum(
        (4.0 / 3.0) * math.pi * b.shape.radius ** 3
        for b in O.bodies
        if isinstance(b.shape, Sphere)
    )
    # 周期性盒子的体积 = det(hSize)
    volBox = O.cell.hSize.determinant()
    return 1.0 - volSpheres / volBox


# 记录初始孔隙率
initialPorosity = computePorosity()
print(f"初始孔隙率: {initialPorosity:.4f}")

# 记录初始体积（用于计算体积应变）
initialVolume = O.cell.hSize.determinant()

# ============================================================
# 辅助函数
# ============================================================

def getStressMeasures():
    """
    从宏观应力张量中提取三轴试验常用的应力指标。

    返回：
        p: 平均应力（球应力），正值表示压应力
        q: 偏应力（剪应力），始终为正值
        sigma_yy: 轴向应力（σ₁ 方向）
        strain_axial: 轴向应变
        strain_vol: 体积应变
    """
    # 获取宏观应力张量
    # 周期性模拟使用 stressTensorOfPeriodicCell()，压应力为负
    stressTensor = utils.stressTensorOfPeriodicCell()

    # 提取三个主应力（在周期性模拟中，对角元素即为主应力）
    # 注意：YADE 中压应力为负，我们取绝对值来计算 p 和 q
    sigma_xx = -stressTensor[0, 0]  # 围压方向（转为正 = 压）
    sigma_yy = -stressTensor[1, 1]  # 轴向（加载方向，σ₁）
    sigma_zz = -stressTensor[2, 2]  # 围压方向

    # 平均应力 p = (σ₁ + σ₂ + σ₃) / 3
    p = (sigma_xx + sigma_yy + sigma_zz) / 3.0

    # 偏应力 q = σ₁ - σ₃（三轴压缩：σ₁ ≥ σ₂ = σ₃）
    q = sigma_yy - min(sigma_xx, sigma_zz)

    # 计算轴向应变
    # 在 yy 方向加载，轴向应变 = 1 - L/L0
    # 对于周期性盒子，当前 yy 边长 = hSize[1,1]
    currentHeight = O.cell.hSize[1, 1]
    strain_axial = 1.0 - currentHeight / side

    # 计算体积应变
    # 体积应变 = (V - V0) / V0，正值表示体积增大（剪胀）
    currentVolume = O.cell.hSize.determinant()
    strain_vol = (currentVolume - initialVolume) / initialVolume

    return p, q, sigma_yy, strain_axial, strain_vol


def computeCoordinationNumber():
    """
    计算配位数（平均每个颗粒的接触数）。
    Z = 2 × 接触数 / 颗粒数
    """
    totalContacts = 0
    totalSpheres = 0
    for b in O.bodies:
        if isinstance(b.shape, Sphere):
            totalSpheres += 1
            for inter in b.intrs():
                if inter.isReal:
                    totalContacts += 1
    if totalSpheres > 0:
        return totalContacts / totalSpheres
    return 0.0


# ============================================================
# 引擎管线设置
# ============================================================

# 使用直接赋值清空引擎列表
O.engines = [
    ForceResetter(),
    InsertionSortCollider([Bo1_Sphere_Aabb()]),
    InteractionLoop(
        [Ig2_Sphere_Sphere_ScGeom()],
        [Ip2_FrictMat_FrictMat_FrictPhys()],
        [Law2_ScGeom_FrictPhys_CundallStrack()]
    ),
    NewtonIntegrator(damping=dampingCoeff),
]

# ============================================================
# 阶段 0：各向同性压缩（建立接触网络）
# ============================================================
# 周期性模拟中没有重力，颗粒初始呈"气态"（无接触）
# PeriTriaxController 需要初始接触才能工作
# 必须先用直接 hSize 操纵缩小盒子，让颗粒互相接触

print("\n" + "=" * 60)
print("三轴试验模拟")
print("=" * 60)
print(f"围压: {confiningPressure / 1e3:.0f} kPa")
print(f"颗粒数量: {len(sphereIds)}")
print(f"初始孔隙率: {initialPorosity:.4f}")
print("=" * 60)

print("\n--- 阶段 0：各向同性压缩 ---")
print("正在压缩颗粒以建立接触网络...")

O.dt = PWaveTimeStep()

# 使用 O.step() 循环进行渐进式压缩
# 每步缩小盒子一点点，同时运行一步模拟
targetRatio = 0.75   # 目标：缩小到 75%
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
        print(f"  步 {step}: 盒子 {O.cell.hSize[0, 0] * 1000:.2f}mm, "
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
print(f"  盒子尺寸: {O.cell.hSize[0, 0] * 1000:.2f} x "
      f"{O.cell.hSize[1, 1] * 1000:.2f} x "
      f"{O.cell.hSize[2, 2] * 1000:.2f} mm")

# 记录压缩后的状态
initialVolume = O.cell.hSize.determinant()
initialPorosity_post = 1.0 - sum(
    (4.0 / 3.0) * math.pi * b.shape.radius ** 3
    for b in O.bodies if isinstance(b.shape, Sphere)
) / initialVolume
print(f"压缩后孔隙率: {initialPorosity_post:.4f}")

# ============================================================
# 全局变量：模拟阶段控制
# ============================================================

simulationPhase = 'consolidation'   # 'consolidation' 或 'loading'
initialVolume_postConsol = None     # 固结后的体积

# ============================================================
# 阶段 1：各向同性固结（PeriTriaxController）
# ============================================================

print("\n--- 阶段 1：各向同性固结 ---")
print(f"目标围压: {confiningPressure / 1e3:.0f} kPa")
print("三方向均施加相同的目标应力...")

# 创建 PeriTriaxController 用于固结阶段
# 现在已有接触网络，PeriTriaxController 可以正常工作
triax = PeriTriaxController(
    goal=(-confiningPressure, -confiningPressure, -confiningPressure),
    stressMask=7,                    # 三向应力控制
    maxUnbalanced=maxUnbalanced,     # 收敛判据
    maxStrainRate=(0.1, 0.1, 0.1),   # 最大应变速率
    globUpdate=5,                    # 全局更新频率
    label='triax'                    # 引擎标签，便于后续引用
)

O.engines.append(triax)

# 主控制函数：管理固结→加载的阶段切换
def mainControl():
    """
    主控制函数：管理固结→加载的阶段切换。
    """
    global simulationPhase, initialVolume_postConsol, initialVolume

    p, q, sigma_yy, strain_axial, strain_vol = getStressMeasures()
    porosity = computePorosity()
    unbal = utils.unbalancedForce()

    if simulationPhase == 'consolidation':
        # --- 固结阶段 ---
        plot.addData(
            pConsol=p,
            qConsol=q,
            nConsol=porosity,
            unbalConsol=unbal,
        )

        # 检查是否达到平衡
        if unbal < maxUnbalanced and O.iter > 5000:
            print(f"\n固结完成！")
            print(f"  p = {p / 1e3:.1f} kPa, q = {q / 1e3:.1f} kPa")
            print(f"  孔隙率 = {porosity:.4f}")
            print(f"  不平衡力 = {unbal:.4f}")

            # 记录固结后的初始状态
            initialVolume_postConsol = O.cell.hSize.determinant()
            initialVolume = initialVolume_postConsol

            # 切换到加载阶段
            simulationPhase = 'loading'

            # 修改 PeriTriaxController 参数
            # stressMask = 5: 仅控制 xx 和 zz，yy 方向自由加载
            triax.goal = (-confiningPressure, 0, -confiningPressure)
            triax.stressMask = 5

            # 重置绘图数据（加载阶段重新记录）
            plot.resetData()

            print("\n--- 阶段 2：偏应力加载 ---")
            print("正在加载中...")

    elif simulationPhase == 'loading':
        # --- 加载阶段 ---
        coordNum = computeCoordinationNumber()

        # 计算加载阶段的轴向应变
        currentHeight = O.cell.hSize[1, 1]
        axialStrain_load = 1.0 - currentHeight / side

        # 记录数据
        plot.addData(
            strain=axialStrain_load,
            q=q,
            p=p,
            sigma_yy=sigma_yy,
            volStrain=strain_vol,
            porosity=porosity,
            coordNum=coordNum,
            unbalanced=unbal,
        )

        # 每隔一定步数打印状态
        if O.iter % 2000 == 0:
            print(f"  e_a = {axialStrain_load * 100:>6.2f}% | "
                  f"p = {p / 1e3:>7.1f} kPa | "
                  f"q = {q / 1e3:>7.1f} kPa | "
                  f"e_v = {strain_vol * 100:>6.2f}% | "
                  f"n = {porosity:.4f}")

        # 检查是否达到破坏应变
        if axialStrain_load > 0.30:
            print(f"\n=== 达到 30% 轴向应变，试验结束 ===")
            print(f"最终 p = {p / 1e3:.1f} kPa")
            print(f"最终 q = {q / 1e3:.1f} kPa")
            print(f"最终孔隙率 = {porosity:.4f}")
            O.pause()


# 添加主控制引擎
O.engines.append(PyRunner(iterPeriod=dataInterval, command='mainControl()'))

# ============================================================
# 绘图设置
# ============================================================

# 定义绘图数据系列
plot.plots = {
    'strain': ('q',),
    'strain ': ('volStrain',),
    'p': ('q ',),
    'strain  ': ('porosity',),
}

# 重置绘图数据
plot.resetData()

# ============================================================
# 设置时间步长并运行
# ============================================================

print(f"\n时间步长: {O.dt:.6e} s")
print(f"开始运行...")

# 运行固结阶段（阻塞模式）
O.run(100000, True)

# 如果固结未完成，继续运行
if simulationPhase == 'consolidation':
    print("固结尚未完成，继续运行...")
    O.run(100000, True)

# 固结完成后，运行加载阶段（非阻塞模式，启用 Qt GUI）
v = qt.View()
import time
print("\n开始加载阶段...")
O.run(500000, False)
while O.running:
    time.sleep(0.1)

print("\n=== 三轴试验完成 ===")

# ============================================================
# 后处理（取消注释以使用）
# ============================================================

# 保存数据
# plot.saveGnuplot('/tmp/triaxial_data')

# 使用 matplotlib 绘制结果
# import matplotlib.pyplot as plt
#
# fig, axes = plt.subplots(2, 2, figsize=(12, 10))
#
# # 应力-应变曲线
# axes[0, 0].plot(plot.data['strain'], plot.data['q'], 'b-', linewidth=1.5)
# axes[0, 0].set_xlabel('轴向应变 ε_a')
# axes[0, 0].set_ylabel('偏应力 q [Pa]')
# axes[0, 0].set_title('应力-应变曲线')
# axes[0, 0].grid(True)
#
# # 体变曲线
# axes[0, 1].plot(plot.data['strain'], plot.data['volStrain'], 'r-', linewidth=1.5)
# axes[0, 1].set_xlabel('轴向应变 ε_a')
# axes[0, 1].set_ylabel('体积应变 ε_v')
# axes[0, 1].set_title('体变曲线')
# axes[0, 1].axhline(y=0, color='k', linestyle='--', alpha=0.3)
# axes[0, 1].grid(True)
#
# # p-q 应力路径
# axes[1, 0].plot(plot.data['p'], plot.data['q'], 'g-', linewidth=1.5)
# # 临界状态线 q = M * p
# M = 6 * math.sin(frictionAngle) / (3 - math.sin(frictionAngle))
# p_max = max(plot.data['p']) * 1.1
# axes[1, 0].plot([0, p_max], [0, M * p_max], 'k--', label=f'CSL (M={M:.2f})')
# axes[1, 0].set_xlabel('平均应力 p [Pa]')
# axes[1, 0].set_ylabel('偏应力 q [Pa]')
# axes[1, 0].set_title('p-q 应力路径')
# axes[1, 0].legend()
# axes[1, 0].grid(True)
#
# # 孔隙率演化
# axes[1, 1].plot(plot.data['strain'], plot.data['porosity'], 'm-', linewidth=1.5)
# axes[1, 1].set_xlabel('轴向应变 ε_a')
# axes[1, 1].set_ylabel('孔隙率 n')
# axes[1, 1].set_title('孔隙率演化')
# axes[1, 1].grid(True)
#
# plt.tight_layout()
# plt.savefig('/tmp/triaxial_results.png', dpi=150)
# plt.show()

input("按回车键退出...")

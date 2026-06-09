# -*- coding: utf-8 -*-
"""
混凝土力学模拟 —— 粘结颗粒模型 (Cpm) 单轴拉伸试验
=====================================================

本脚本使用 Cpm (Cohesive Particle Model) 模型模拟混凝土的单轴拉伸行为。
- 材料模型：CpmMat（含拉伸强度、损伤演化）
- 加载方式：UniaxialStrainer 控制的单轴拉伸
- 输出数据：应力-应变曲线、损伤演化

运行方式：
    yadedaily concrete_mechanics.py
"""

# ============================================================
# 导入模块
# ============================================================
from yade import pack, plot, utils
from yade.utils import Vector3
import math
import os

# ============================================================
# 混凝土材料参数
# ============================================================

# --- 弹性参数 ---
young = 30e9            # 杨氏模量 [Pa]，混凝土典型值约 30 GPa
poisson = 0.2           # 泊松比，混凝土约 0.15~0.25
frictionAngle = 0.6     # 接触摩擦角 [rad]（约 34°）
density = 2500          # 混凝土密度 [kg/m³]

# --- Cpm 特有参数 ---
sigmaT = 3e6            # 拉伸强度 [Pa]，混凝土约 2~5 MPa
relDuctility = 0.1      # 相对延性：控制软化段形状
                        #   小值（0.01）→ 脆性断裂，应力急剧下降
                        #   大值（0.5）→ 延性行为，应力缓慢下降
epsCrackOnset = 1e-4    # 开裂应变阈值，超过此值损伤开始累积

# --- 试样几何参数 ---
specimenRadius = 0.025  # 圆柱试样半径 [m]（25 mm）
specimenHeight = 0.10   # 圆柱试样高度 [m]（100 mm）
rMean = 0.003           # 颗粒平均半径 [m]（3 mm）
                        # 注：实际混凝土骨料模拟需要更小的颗粒

# --- 加载参数 ---
strainRate = 0.05       # 拉伸应变速率 [1/s]
                        # 注意：准静态模拟需要足够慢的应变速率
                        # 但太慢会增加计算时间
maxStrain = 0.005       # 最大拉伸应变（0.5%，足够观察软化段）

# --- 阻尼参数 ---
dampingCoeff = 0.4      # 局部阻尼系数

# --- 数据采集参数 ---
dataInterval = 100       # 数据采集间隔

# ============================================================
# 材料定义 —— CpmMat
# ============================================================

# CpmMat (Cohesive Particle Material) 是用于模拟混凝土等粘结材料的材料模型
# 与 FrictMat 相比，CpmMat 额外引入了：
#   - sigmaT: 拉伸强度，接触能承受的最大拉力
#   - relDuctility: 相对延性，控制损伤演化的速度
#   - epsCrackOnset: 开裂应变阈值，损伤开始累积的应变值
O.materials.append(CpmMat(
    young=young,
    poisson=poisson,
    frictionAngle=frictionAngle,
    density=density,
    sigmaT=sigmaT,
    relDuctility=relDuctility,
    epsCrackOnset=epsCrackOnset,
    label='concrete'
))

# ============================================================
# 生成圆柱形试样
# ============================================================

# 使用 randomDensePack 在圆柱区域内生成致密堆积
# pack.inCylinder() 定义了圆柱形区域：
#   - 底面中心: (0, 0, 0)
#   - 顶面中心: (0, 0, specimenHeight)
#   - 半径: specimenRadius

print("正在生成圆柱形试样...")

sp = pack.randomDensePack(
    pack.inCylinder(
        (0, 0, 0),                            # 底面中心
        (0, 0, specimenHeight),               # 顶面中心
        specimenRadius                        # 半径
    ),
    radius=rMean,                             # 颗粒平均半径
    rRelFuzz=0.2,                             # 半径分散度
    spheresInCell=200,                        # 每个周期性单元的颗粒数
    seed=42,                                  # 随机种子（可复现）
    returnSpherePack=True,                    # 返回 SpherePack 对象
)

# 将颗粒添加到仿真中
sphereIds = sp.toSimulation()

# 记录试样信息
nSpheres = len(sphereIds)
print(f"已生成 {nSpheres} 个颗粒")

# 计算试样的几何边界
zCoords = [O.bodies[i].state.pos[2] for i in sphereIds if O.bodies[i] is not None]
zMin = min(zCoords)
zMax = max(zCoords)
actualHeight = zMax - zMin
print(f"试样高度: {actualHeight * 1000:.1f} mm")

# ============================================================
# 识别加载端颗粒
# ============================================================

# UniaxialStrainer 需要知道哪些颗粒在试样的两端（作为"加载板"）
# 我们通过 z 坐标来识别

# 端部容差：取几个颗粒半径的厚度
endTol = rMean * 4  # 约 12 mm

# 正端颗粒（z 接近 zMax）—— 将被向上拉
posIds = []
# 负端颗粒（z 接近 zMin）—— 将被向下拉（或固定）
negIds = []

for i in sphereIds:
    b = O.bodies[i]
    if b is None:
        continue
    z = b.state.pos[2]
    if z >= zMax - endTol:
        posIds.append(b.id)
    elif z <= zMin + endTol:
        negIds.append(b.id)

print(f"正端颗粒数: {len(posIds)}")
print(f"负端颗粒数: {len(negIds)}")

# ============================================================
# 全局变量
# ============================================================

# 试样截面积（近似为圆形截面）
crossSectionArea = math.pi * specimenRadius ** 2

# 峰值应力跟踪
peakStress = 0.0
peakDetected = False

# 损伤统计
totalDamage = 0.0
nDamagedContacts = 0

# ============================================================
# 引擎管线设置
# ============================================================

# Cpm 模型的引擎管线与 FrictMat 有重要区别：
#   1. Ip2 使用 Ip2_CpmMat_CpmMat_CpmPhys（而非 Ip2_FrictMat_FrictMat_FrictPhys）
#   2. Law2 使用 Law2_ScGeom_CpmPhys_Cpm（而非 Law2_ScGeom_FrictPhys_CundallStrack）
#   3. 可选添加 CpmStateUpdater 用于状态更新

O.engines = [
    # 步骤 1：力清零
    ForceResetter(),

    # 步骤 2：碰撞检测
    InsertionSortCollider([Bo1_Sphere_Aabb()]),

    # 步骤 3：接触力计算
    InteractionLoop(
        [Ig2_Sphere_Sphere_ScGeom()],          # 球-球接触几何
        [Ip2_CpmMat_CpmMat_CpmPhys()],          # Cpm 材料的接触物理
        [Law2_ScGeom_CpmPhys_Cpm()]             # Cpm 本构律
    ),

    # 步骤 4：运动积分
    NewtonIntegrator(damping=dampingCoeff),

    # 步骤 5：Cpm 状态更新
    # 更新每个接触的损伤状态，用于后处理和 GUI 显示
    CpmStateUpdater(),

    # 步骤 6：单轴拉伸加载
    # UniaxialStrainer 通过移动两端的颗粒来施加均匀的单轴应变
    UniaxialStrainer(
        axis=2,                               # z 方向加载
        strainRate=strainRate,                # 应变速率 [1/s]
        originalLength=actualHeight,          # 试样初始高度
        crossSectionArea=crossSectionArea,    # 试样截面积
        posIds=posIds,                        # 正端颗粒 ID
        negIds=negIds,                        # 负端颗粒 ID
        asymmetry=0,                          # 对称加载
        blockDisplacements=False,             # 不约束位移
        blockRotations=False,                 # 不约束旋转
        setSpeeds=True,                       # 使用速度控制
        label='strainer'
    ),

    # 步骤 7：数据采集和破坏检测
    PyRunner(iterPeriod=dataInterval, command='collectData()'),
    PyRunner(iterPeriod=500, command='checkFailure()'),
    PyRunner(iterPeriod=2000, command='printStatus()'),
]

# ============================================================
# 数据采集函数
# ============================================================

def collectData():
    """
    采集应力-应变和损伤数据。

    应力计算方法：
    - 获取两端颗粒上的合力
    - 应力 = 力 / 截面积

    应变计算方法：
    - 由 UniaxialStrainer 的 strain 属性直接获取
    """
    global peakStress, peakDetected, totalDamage, nDamagedContacts

    # --- 获取轴向应变 ---
    # UniaxialStrainer 记录了当前的宏观应变
    # 正值表示拉伸，负值表示压缩
    axialStrain = O.engines[5].strain  # strainer 的 strain 属性

    # --- 获取轴向应力 ---
    # 使用 UniaxialStrainer 内置的 avgStress 属性（自动计算，符号正确）
    axialStress = O.engines[5].avgStress

    # --- 更新峰值应力 ---
    if axialStress > peakStress:
        peakStress = axialStress

    # --- 计算平均损伤 ---
    # 遍历所有接触，统计损伤值
    damageSum = 0.0
    damagedCount = 0
    totalContacts = 0
    for inter in O.interactions:
        if not inter.isReal:
            continue
        totalContacts += 1
        d = inter.phys.omega  # CpmPhys 使用 omega 表示损伤
        damageSum += d
        if d > 0.01:  # 损伤超过 1% 的接触
            damagedCount += 1

    avgDamage = damageSum / totalContacts if totalContacts > 0 else 0.0
    totalDamage = avgDamage
    nDamagedContacts = damagedCount

    # --- 记录数据 ---
    plot.addData(
        iter=O.iter,
        strain=axialStrain * 1000,       # 应变 × 1000（千分比）
        stress=axialStress / 1e6,         # 应力 [MPa]
        damage=avgDamage,                 # 平均损伤
        nDamaged=damagedCount,            # 受损接触数
        nTotal=totalContacts,             # 总接触数
        peakStress=peakStress / 1e6,      # 峰值应力 [MPa]
    )


def checkFailure():
    """
    检测试样是否已破坏。

    破坏判据：
    1. 应力下降到峰值的 50% 以下
    2. 或超过最大应变
    """
    global peakDetected

    axialStrain = O.engines[5].strain
    axialStress = O.engines[5].avgStress

    # 检测峰值（应力开始下降）
    if axialStress < peakStress * 0.95 and peakStress > 0:
        peakDetected = True

    # 检测破坏（应力下降到峰值的 30%）
    if peakDetected and axialStress < peakStress * 0.3:
        print(f"\n=== 试样破坏！ ===")
        print(f"峰值应力: {peakStress / 1e6:.2f} MPa")
        print(f"破坏应变: {axialStrain * 1000:.2f} ‰")
        print(f"平均损伤: {totalDamage:.4f}")
        print(f"受损接触数: {nDamagedContacts}")
        O.pause()

    # 超过最大应变
    if axialStrain > maxStrain:
        print(f"\n=== 达到最大应变 {maxStrain * 1000:.1f} ‰，试验结束 ===")
        print(f"峰值应力: {peakStress / 1e6:.2f} MPa")
        O.pause()


def printStatus():
    """定期打印试验状态"""
    axialStrain = O.engines[5].strain
    axialStress = O.engines[5].avgStress

    print(f"  ε = {axialStrain * 1000:>7.3f} ‰ | "
          f"σ = {axialStress / 1e6:>7.3f} MPa | "
          f"σ_peak = {peakStress / 1e6:>7.3f} MPa | "
          f"损伤 = {totalDamage:>6.4f} | "
          f"受损接触 = {nDamagedContacts:>5d}")


# ============================================================
# 绘图设置
# ============================================================

plot.plots = {
    # 图 1：应力-应变曲线
    'strain': ('stress',),

    # 图 2：损伤演化
    'strain ': ('damage',),

    # 图 3：受损接触数
    'strain  ': ('nDamaged',),
}

plot.resetData()

# ============================================================
# 设置时间步长并运行
# ============================================================

# Cpm 模型的杨氏模量较大，需要更小的时间步以确保稳定
O.dt = 0.5 * PWaveTimeStep()

print("\n" + "=" * 60)
print("混凝土单轴拉伸试验 —— Cpm 模型")
print("=" * 60)
print(f"杨氏模量:     {young / 1e9:.0f} GPa")
print(f"泊松比:       {poisson}")
print(f"拉伸强度:     {sigmaT / 1e6:.1f} MPa")
print(f"相对延性:     {relDuctility}")
print(f"开裂应变:     {epsCrackOnset}")
print(f"试样半径:     {specimenRadius * 1000:.1f} mm")
print(f"试样高度:     {actualHeight * 1000:.1f} mm")
print(f"颗粒数量:     {nSpheres}")
print(f"应变速率:     {strainRate} /s")
print(f"时间步长:     {O.dt:.6e} s")
print(f"截面积:       {crossSectionArea * 1e6:.2f} mm²")
print("=" * 60)
print("\n开始拉伸试验...")
print("-" * 60)

# 运行拉伸试验（checkFailure 函数会在破坏时暂停）
O.run()
import time
while O.running:
    time.sleep(0.5)

print("模拟完成！")

# ============================================================
# 后处理（取消注释以使用）
# ============================================================

# # 保存数据
# plot.saveGnuplot('/tmp/concrete_tension')
#
# # 使用 matplotlib 绘制结果
# import matplotlib.pyplot as plt
#
# fig, axes = plt.subplots(1, 3, figsize=(15, 5))
#
# # 应力-应变曲线
# axes[0].plot(plot.data['strain'], plot.data['stress'], 'b-', linewidth=1.5)
# axes[0].axhline(y=sigmaT/1e6, color='r', linestyle='--',
#                 label=f'σT = {sigmaT/1e6:.0f} MPa')
# axes[0].set_xlabel('应变 ε [‰]')
# axes[0].set_ylabel('应力 σ [MPa]')
# axes[0].set_title('单轴拉伸应力-应变曲线')
# axes[0].legend()
# axes[0].grid(True)
#
# # 损伤演化
# axes[1].plot(plot.data['strain'], plot.data['damage'], 'r-', linewidth=1.5)
# axes[1].set_xlabel('应变 ε [‰]')
# axes[1].set_ylabel('平均损伤 d')
# axes[1].set_title('损伤演化')
# axes[1].grid(True)
#
# # 受损接触数
# axes[2].plot(plot.data['strain'], plot.data['nDamaged'], 'g-', linewidth=1.5)
# axes[2].set_xlabel('应变 ε [‰]')
# axes[2].set_ylabel('受损接触数')
# axes[2].set_title('裂纹发展')
# axes[2].grid(True)
#
# plt.tight_layout()
# plt.savefig('/tmp/concrete_tension_results.png', dpi=150)
# plt.show()

quit()

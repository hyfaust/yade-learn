# -*- coding: utf-8 -*-
"""
流固耦合模拟 —— 使用 HydroForceEngine 模拟流化床
====================================================

本脚本模拟流体向上通过颗粒床层的过程：
  阶段 1：重力沉积 —— 颗粒在容器底部形成堆积
  阶段 2：流体注入 —— 流体从底部向上流动，观察流化现象

使用 HydroForceEngine 施加流体阻力和浮力。

运行方式：
    yadedaily fluid_coupling.py
"""

# ============================================================
# 导入模块
# ============================================================
from yade import pack, plot, utils
from yade.utils import Vector3
import math
import numpy as np

# ============================================================
# 参数定义
# ============================================================

# --- 材料参数 ---
young = 5e6             # 杨氏模量 [Pa]
poisson = 0.3           # 泊松比
frictionAngle = 0.5     # 摩擦角 [rad]（约 28.6°）
density = 2600          # 颗粒密度 [kg/m³]（砂土典型值）

# --- 颗粒参数 ---
rMean = 0.003           # 颗粒平均半径 [m]（3 mm）
rRelFuzz = 0.2          # 半径相对分散度
numSpheres = 800        # 颗粒数量

# --- 容器参数 ---
containerWidth = 0.10   # 容器宽度 [m]（x 方向）
containerDepth = 0.10   # 容器深度 [m]（y 方向）
containerHeight = 0.20  # 容器高度 [m]（z 方向）
wallThickness = 0.005   # 墙壁厚度 [m]

# --- 流体参数 ---
fluidVelocity = 0.5     # 流体竖向速度 [m/s]（正值表示向上）
rhoFluid = 1000         # 流体密度 [kg/m³]（水：1000；空气：1.225）
viscosity = 1e-3        # 流体动力粘度 [Pa·s]（水在 20°C：1.0 × 10⁻³）
kinematicViscosity = viscosity / rhoFluid  # 运动粘度 [m²/s]

# --- 流体层参数 ---
nLayers = 30            # 流体分层数（沿 z 方向）
dz = containerHeight / nLayers  # 每层厚度 [m]
expoRZ = 3.1            # Richardson-Zaki 指数（用于阻力函数）

# --- 阻尼参数 ---
dampingCoeff = 0.3      # 局部阻尼系数（流化床模拟需要较大阻尼以抑制振荡）

# --- 数据采集参数 ---
dataInterval = 200       # 数据采集间隔（步数）

# --- 流化阶段参数 ---
depositionSteps = 20000  # 沉积阶段步数
fluidMaxSteps = 50000    # 流化阶段最大步数

# ============================================================
# 材料定义
# ============================================================

O.materials.append(FrictMat(
    young=young,
    poisson=poisson,
    frictionAngle=frictionAngle,
    density=density,
    label='sand'
))

# ============================================================
# 创建容器
# ============================================================

# 底面（法向朝上的墙）
wallBot = O.bodies.append(wall(0, axis=2, sense=1))
O.bodies[wallBot].dynamic = False

# 顶部（法向朝下的墙，防止颗粒飞出）
wallTop = O.bodies.append(wall(position=containerHeight, axis=2, sense=-1))
O.bodies[wallTop].dynamic = False

# x 方向的两面墙
wallX0 = O.bodies.append(wall(position=0, axis=0, sense=1))
O.bodies[wallX0].dynamic = False

wallX1 = O.bodies.append(wall(position=containerWidth, axis=0, sense=-1))
O.bodies[wallX1].dynamic = False

# y 方向的两面墙
wallY0 = O.bodies.append(wall(position=0, axis=1, sense=1))
O.bodies[wallY0].dynamic = False

wallY1 = O.bodies.append(wall(position=containerDepth, axis=1, sense=-1))
O.bodies[wallY1].dynamic = False

print("容器已创建")

# ============================================================
# 生成颗粒堆积
# ============================================================

# 在容器底部区域生成随机球体
sp = pack.SpherePack()
sp.makeCloud(
    minCorner=(0, 0, rMean * 2),                     # 底部留一点空间
    maxCorner=(containerWidth, containerDepth, 0.12), # 颗粒层高度约 12 cm
    rMean=rMean,
    rRelFuzz=rRelFuzz,
    num=numSpheres,
    periodic=False
)

sphereIds = sp.toSimulation()
nSpheres = len(sphereIds)

print(f"已生成 {nSpheres} 个颗粒")

# ============================================================
# 计算孔隙率分布
# ============================================================

def computeVoidFractionProfile():
    """
    计算沿 z 方向的孔隙率分布。

    方法：将容器高度分成 nLayers 层，对每层统计颗粒体积，
    计算该层的孔隙率。

    返回：一维数组，长度 = nLayers
    """
    dz = containerHeight / nLayers
    voidFracs = []

    for layer in range(nLayers):
        zLow = layer * dz
        zHigh = (layer + 1) * dz

        # 该层的总体积
        layerVolume = containerWidth * containerDepth * dz

        # 统计该层中颗粒占据的体积
        sphereVolume = 0.0
        for b in O.bodies:
            if not isinstance(b.shape, Sphere):
                continue
            z = b.state.pos[2]
            r = b.shape.radius

            # 颗粒中心在该层范围内
            if zLow <= z < zHigh:
                sphereVolume += (4.0 / 3.0) * math.pi * r ** 3

        # 计算孔隙率
        if layerVolume > 0:
            voidFrac = 1.0 - sphereVolume / layerVolume
            voidFrac = max(voidFrac, 0.3)  # 下限约束
            voidFrac = min(voidFrac, 1.0)  # 上限约束
        else:
            voidFrac = 0.4  # 默认值

        voidFracs.append(voidFrac)

    return voidFracs


# 计算初始孔隙率分布
initialVoidFrac = computeVoidFractionProfile()
print(f"初始平均孔隙率: {sum(initialVoidFrac) / len(initialVoidFrac):.3f}")

# ============================================================
# 收集动态颗粒 ID
# ============================================================

idApplyForce = []
for b in O.bodies:
    if isinstance(b.shape, Sphere) and b.dynamic:
        idApplyForce.append(b.id)

print(f"将对 {len(idApplyForce)} 个颗粒施加流体力")

# ============================================================
# 雷诺数估算
# ============================================================

# 估算雷诺数以确认阻力模型的适用性
Re_est = rhoFluid * (2 * rMean) * fluidVelocity / viscosity
print(f"\n雷诺数估算: Re = {Re_est:.1f}")
if Re_est < 1:
    print("  → 层流，建议使用 Stokes 阻力模型")
elif Re_est < 1000:
    print("  → 过渡区，建议使用 DiFelice 或 Ergun 模型")
else:
    print("  → 湍流，建议使用 Newton 模型")

# 估算最小流化速度（Ergun 方程近似）
eps_mf = 0.45  # 最小流化时的典型孔隙率
d_p = 2 * rMean  # 颗粒直径
rhoEff = density - rhoFluid  # 有效密度
U_mf_approx = (d_p ** 2 * rhoEff * 9.81 * eps_mf ** 3) / (
    180 * viscosity * (1 - eps_mf)
)
print(f"最小流化速度估算 (Ergun): U_mf ≈ {U_mf_approx:.3f} m/s")

if fluidVelocity < U_mf_approx:
    print("  → 当前流速低于最小流化速度，床层可能保持静止")
else:
    print("  → 当前流速超过最小流化速度，预期发生流化")

# ============================================================
# 引擎管线设置
# ============================================================

O.engines = [
    # 步骤 1：力清零
    ForceResetter(),

    # 步骤 2：碰撞检测
    InsertionSortCollider([
        Bo1_Sphere_Aabb(),
        Bo1_Wall_Aabb()
    ]),

    # 步骤 3：接触力计算
    InteractionLoop(
        [Ig2_Sphere_Sphere_ScGeom(), Ig2_Wall_Sphere_ScGeom()],
        [Ip2_FrictMat_FrictMat_FrictPhys()],
        [Law2_ScGeom_FrictPhys_CundallStrack()]
    ),

    # 步骤 4：流体力引擎
    # HydroForceEngine 在每个时间步对每个颗粒施加阻力和浮力
    HydroForceEngine(
        densFluid=rhoFluid,               # 流体密度 [kg/m³]
        viscoDyn=viscosity,
        zRef=0.0,
        gravity=Vector3(0, 0, -9.81),
        deltaZ=dz,
        expoRZ=expoRZ,
        lift=False,
        nCell=nLayers,
        vCell=containerWidth * containerDepth * dz,
        radiusPart=rMean,
        label='hydroEngine',
        dead=True,  # 初始不激活，等沉积完成后再激活
        phiMax=0.61,
        iturbu=0,  # 不使用湍流模型
        iusl=0,  # 固定壁面条件
    ),

    # 步骤 5：运动积分
    NewtonIntegrator(damping=dampingCoeff, gravity=(0, 0, -9.81)),

    # 步骤 6：数据采集
    PyRunner(iterPeriod=dataInterval, command='collectData()'),

    # 步骤 7：状态监控
    PyRunner(iterPeriod=2000, command='printStatus()'),
]

# ============================================================
# 全局变量
# ============================================================

# 当前仿真阶段
phase = 'deposition'  # 'deposition'（沉积）或 'fluidization'（流化）

# 流化监测数据
bedHeights = []        # 床高历史
fluidStartTime = 0     # 流化开始时间

# ============================================================
# 辅助函数
# ============================================================

def measureBedHeight():
    """
    测量颗粒床的平均高度。

    方法：取所有球体 z 坐标的平均值作为"床高"的估计。
    更精确的方法是取某个百分位数。
    """
    heights = []
    for b in O.bodies:
        if isinstance(b.shape, Sphere):
            heights.append(b.state.pos[2] + b.shape.radius)

    if not heights:
        return 0.0

    # 使用 z 坐标的 90 百分位作为"床面高度"
    # （比平均值更能反映实际的床面位置）
    heights.sort()
    idx = int(len(heights) * 0.9)
    return heights[idx]


def measureAverageVelocity():
    """
    测量颗粒的平均速度（动能相关）。
    """
    totalKE = 0.0
    count = 0
    for b in O.bodies:
        if isinstance(b.shape, Sphere):
            m = b.state.mass
            v = b.state.vel.norm()
            totalKE += 0.5 * m * v * v
            count += 1

    return totalKE / count if count > 0 else 0.0


def computeCoordinationNumber():
    """
    计算配位数。
    """
    totalContacts = 0
    totalSpheres = 0
    for b in O.bodies:
        if isinstance(b.shape, Sphere):
            totalSpheres += 1
            for inter in b.intrs():
                if inter.isReal:
                    totalContacts += 1

    return totalContacts / totalSpheres if totalSpheres > 0 else 0.0


# ============================================================
# 数据采集函数
# ============================================================

def collectData():
    """
    采集流化过程中的数据。
    """
    # 测量床高
    bedHeight = measureBedHeight()
    bedHeights.append(bedHeight)

    # 测量平均动能
    avgKE = measureAverageVelocity()

    # 测量配位数
    coordNum = computeCoordinationNumber()

    # 计算颗粒群的平均高度
    heights = [b.state.pos[2] for b in O.bodies if isinstance(b.shape, Sphere)]
    avgHeight = sum(heights) / len(heights) if heights else 0

    # 计算高度标准差（反映颗粒的运动幅度）
    if len(heights) > 1:
        mean_h = avgHeight
        stdHeight = (sum((h - mean_h) ** 2 for h in heights) / len(heights)) ** 0.5
    else:
        stdHeight = 0

    # 计算底部墙上的力（与压力降相关）
    bottomForce = abs(O.forces.f(wallBot)[2])
    # 压力降 ≈ 底部力 / 截面积
    crossArea = containerWidth * containerDepth
    pressureDrop = bottomForce / crossArea

    plot.addData(
        iter=O.iter,
        time=O.time,
        bedHeight=bedHeight,            # 床面高度 [m]
        avgHeight=avgHeight,            # 颗粒平均高度 [m]
        stdHeight=stdHeight,            # 高度标准差 [m]
        avgKE=avgKE,                    # 平均动能 [J]
        coordNum=coordNum,              # 配位数
        pressureDrop=pressureDrop,      # 压力降 [Pa]
        phase=0 if phase == 'deposition' else 1,  # 阶段标记
    )


def printStatus():
    """打印当前状态"""
    bedHeight = measureBedHeight()
    avgKE = measureAverageVelocity()
    coordNum = computeCoordinationNumber()

    print(f"  阶段: {phase:>12s} | "
          f"iter: {O.iter:>8d} | "
          f"床高: {bedHeight * 100:>6.1f} cm | "
          f"平均动能: {avgKE:>10.4e} J | "
          f"配位数: {coordNum:>5.2f} | "
          f"不平衡力: {utils.unbalancedForce():>6.4f}")


# ============================================================
# 绘图设置
# ============================================================

plot.plots = {
    # 图 1：床高演化
    'time': ('bedHeight',),

    # 图 2：平均动能（反映运动剧烈程度）
    'time ': ('avgKE',),

    # 图 3：配位数（反映颗粒间接触状态）
    'time  ': ('coordNum',),

    # 图 4：压力降
    'time   ': ('pressureDrop',),
}

plot.resetData()

# ============================================================
# 设置时间步长并运行
# ============================================================

O.dt = PWaveTimeStep()

print("\n" + "=" * 60)
print("流固耦合模拟 —— 流化床")
print("=" * 60)
print(f"颗粒数量:     {nSpheres}")
print(f"颗粒半径:     {rMean * 1000:.1f} mm")
print(f"颗粒密度:     {density} kg/m³")
print(f"容器尺寸:     {containerWidth * 1000:.0f} × {containerDepth * 1000:.0f} × {containerHeight * 1000:.0f} mm")
print(f"流体速度:     {fluidVelocity} m/s")
print(f"流体密度:     {rhoFluid} kg/m³")
print(f"流体粘度:     {viscosity} Pa·s")
print(f"分层数:       {nLayers}")
print(f"雷诺数:       Re ≈ {Re_est:.1f}")
print(f"U_mf 估算:    {U_mf_approx:.3f} m/s")
print(f"时间步长:     {O.dt:.6e} s")
print("=" * 60)

# ============================================================
# 阶段 1：重力沉积
# ============================================================

print("\n--- 阶段 1：重力沉积 ---")
print(f"正在等待颗粒沉积到容器底部...（{depositionSteps} 步）")

# 重力沉积
O.run(depositionSteps, True)  # 阻塞运行

print(f"\n沉积完成！")
print(f"床面高度: {measureBedHeight() * 100:.1f} cm")
print(f"配位数: {computeCoordinationNumber():.2f}")

# 重新计算孔隙率分布（沉积后）
initialVoidFrac = computeVoidFractionProfile()
avgVoidFrac = sum(initialVoidFrac) / len(initialVoidFrac)
print(f"沉积后平均孔隙率: {avgVoidFrac:.3f}")

# ============================================================
# 阶段 2：流体注入
# ============================================================

print("\n--- 阶段 2：流体注入 ---")
print(f"开始向上注入流体，速度 = {fluidVelocity} m/s")
print("观察颗粒床是否发生流化...\n")

# 切换到流化阶段
phase = 'fluidization'
fluidStartTime = O.time

# 激活流体力引擎
hydroEngine.dead = False

# 设置流体速度分布
# vzFluid: 每层的流体竖向速度（正值 = 向上流动）
hydroEngine.vzFluid = [fluidVelocity] * nLayers
hydroEngine.vxFluid = [0.0] * nLayers  # x 方向无流速

# 设置每层孔隙率（用于阻力计算）
hydroEngine.zVoid = initialVoidFrac

# 重置绘图数据（仅记录流化阶段）
plot.resetData()

# 运行模拟（有限步数，防止无限运行）
print(f"正在运行中...（最多 {fluidMaxSteps} 步）")

O.run(fluidMaxSteps, True)  # 阻塞运行，到达步数后自动停止

print("模拟完成！")

# ============================================================
# 后处理（取消注释以使用）
# ============================================================

# # 保存数据
# plot.saveGnuplot('/tmp/fluid_coupling_data')
#
# # 使用 matplotlib 绘制结果
# import matplotlib.pyplot as plt
#
# fig, axes = plt.subplots(2, 2, figsize=(12, 10))
#
# # 床高演化
# axes[0, 0].plot(plot.data['time'], [h * 100 for h in plot.data['bedHeight']],
#                 'b-', linewidth=1.5)
# axes[0, 0].set_xlabel('时间 [s]')
# axes[0, 0].set_ylabel('床面高度 [cm]')
# axes[0, 0].set_title('流化床床高演化')
# axes[0, 0].grid(True)
#
# # 平均动能
# axes[0, 1].plot(plot.data['time'], plot.data['avgKE'], 'g-', linewidth=1.5)
# axes[0, 1].set_xlabel('时间 [s]')
# axes[0, 1].set_ylabel('平均动能 [J]')
# axes[0, 1].set_title('颗粒运动能量')
# axes[0, 1].set_yscale('log')
# axes[0, 1].grid(True)
#
# # 配位数
# axes[1, 0].plot(plot.data['time'], plot.data['coordNum'], 'r-', linewidth=1.5)
# axes[1, 0].set_xlabel('时间 [s]')
# axes[1, 0].set_ylabel('配位数')
# axes[1, 0].set_title('配位数演化')
# axes[1, 0].grid(True)
#
# # 压力降
# axes[1, 1].plot(plot.data['time'], plot.data['pressureDrop'], 'm-', linewidth=1.5)
# axes[1, 1].set_xlabel('时间 [s]')
# axes[1, 1].set_ylabel('压力降 [Pa]')
# axes[1, 1].set_title('压力降变化')
# axes[1, 1].grid(True)
#
# plt.tight_layout()
# plt.savefig('/tmp/fluid_coupling_results.png', dpi=150)
# plt.show()

quit()

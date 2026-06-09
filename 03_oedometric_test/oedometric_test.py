# -*- coding: utf-8 -*-
"""
一维压缩试验（Oedometric Test）- YADE 离散元模拟
=================================================

本脚本模拟颗粒材料在一维侧限条件下的压缩行为。
- 竖向加载：通过顶部墙向下移动实现
- 侧向约束：通过固定侧向边界颗粒的 x、y 位移实现
- 数据采集：记录应力-应变曲线，计算 K0 值

运行方式：
    yadedaily oedometric_test.py
"""

# ============================================================
# 导入必要的 YADE 模块
# ============================================================
from yade import pack, plot, utils, qt
from yade.utils import Vector3
import numpy as np

# ============================================================
# 模拟参数定义
# ============================================================

# --- 颗粒材料参数 ---
young = 5e6           # 杨氏模量 [Pa]，控制颗粒刚度
poisson = 0.3         # 泊松比，影响侧向变形行为
frictionAngle = 0.5   # 颗粒间摩擦角 [rad]（约 28.6°）
density = 2600        # 颗粒密度 [kg/m³]，典型砂土密度

# --- 试样几何参数 ---
width = 0.04          # 试样宽度 [m]（x 方向）
depth = 0.04          # 试样深度 [m]（y 方向）
height = 0.08         # 试样高度 [m]（z 方向）

# --- 颗粒生成参数 ---
rMean = 0.002         # 颗粒平均半径 [m]
rRelFuzz = 0.3        # 半径相对分散度（0=等径，越大越分散）
spheresNum = 500      # 目标颗粒数量

# --- 加载参数 ---
loadingRate = -0.05   # 顶部墙加载速率 [m/s]，负值表示向下压缩
maxStrain = 0.15      # 最大轴向应变（15%）
targetStrain = 0.05   # 第一阶段目标应变

# --- 阻尼参数 ---
dampingCoeff = 0.4    # 局部阻尼系数，用于耗散动能（准静态加载）

# ============================================================
# 材料定义
# ============================================================

# 定义摩擦材料（FrictMat）
# - young：杨氏模量，控制颗粒间的接触刚度
# - poisson：泊松比，影响法向与切向刚度的比值
# - frictionAngle：摩擦角，控制颗粒间的抗剪强度
# - density：密度，用于计算颗粒的质量和惯性
O.materials.append(FrictMat(
    young=young,
    poisson=poisson,
    frictionAngle=frictionAngle,
    density=density
))

# ============================================================
# 生成球体堆积
# ============================================================

# 使用 SpherePack 的 makeCloud 方法生成随机球体堆积
# - 第一个参数：生成区域的最小角点 (x_min, y_min, z_min)
# - 第二个参数：生成区域的最大角点 (x_max, y_max, z_max)
# - rMean：平均半径
# - rRelFuzz：半径的相对分散度（uniform 分布，半径在 [rMean*(1-rRelFuzz), rMean*(1+rRelFuzz)] 之间）
# - num：目标颗粒数量
# - periodic：False 表示非周期性边界
sp = pack.SpherePack()
sp.makeCloud(
    (0, 0, 0),                    # 区域最小角点
    (width, depth, height),       # 区域最大角点
    rMean=rMean,                  # 平均半径
    rRelFuzz=rRelFuzz,            # 半径分散度
    num=spheresNum,               # 颗粒数量
    periodic=False                # 非周期性边界
)

# 将 SpherePack 中的颗粒添加到模拟中
# 返回添加的颗粒 id 列表
sphereIds = sp.toSimulation()

print(f"已生成 {len(sphereIds)} 个颗粒")

# ============================================================
# 创建边界墙
# ============================================================

# 底部墙（z = 0 平面，法向朝上）
# axis=2 表示墙的法向沿 z 轴
# sense=1 表示墙的法向朝正方向（向上）
wallBot = utils.wall(position=0, axis=2, sense=1)
wallBotId = O.bodies.append(wallBot)

# 顶部墙（z = height 平面，法向朝下）
# sense=-1 表示墙的法向朝负方向（向下）
wallTop = utils.wall(position=height, axis=2, sense=-1)
wallTopId = O.bodies.append(wallTop)

# 底部墙固定不动（设置为非动态）
O.bodies[wallBotId].dynamic = False
# 顶部墙也先设为非动态，后续手动控制其速度
O.bodies[wallTopId].dynamic = False

print(f"底部墙 ID: {wallBotId}, 顶部墙 ID: {wallTopId}")

# ============================================================
# 标记侧向边界颗粒并施加约束
# ============================================================

# 一维压缩试验的关键：侧向应变为零
# 实现方法：固定位于试样侧边界的颗粒的 x 和 y 方向位移

# 定义边界容差（略大于最大颗粒半径）
boundaryTol = rMean * (1 + rRelFuzz) * 1.1

# 遍历所有球体颗粒，检查是否位于侧向边界
constrainedCount = 0
for i in sphereIds:
    b = O.bodies[i]
    if b is None or not isinstance(b.shape, Sphere):
        continue
    pos = b.state.pos
    x, y, z = pos[0], pos[1], pos[2]

    # 判断颗粒是否位于侧向边界附近
    # x 方向边界：x < boundaryTol 或 x > width - boundaryTol
    # y 方向边界：y < boundaryTol 或 y > depth - boundaryTol
    isXBoundary = (x < boundaryTol) or (x > width - boundaryTol)
    isYBoundary = (y < boundaryTol) or (y > depth - boundaryTol)

    if isXBoundary or isYBoundary:
        # 约束 x 和 y 方向的平移自由度
        # 'xyz' 表示约束三个方向，'xy' 表示仅约束 x 和 y
        b.state.blockedDOFs = 'xy'
        b.dynamic = False
        constrainedCount += 1

print(f"已约束 {constrainedCount} 个侧向边界颗粒（限制 x、y 方向位移）")

# ============================================================
# 截面积估算
# ============================================================

# 一维压缩试验中，应力 = 力 / 截面积
# 试样的横截面积为 width × depth
crossSectionArea = width * depth

# 记录初始试样高度
initialHeight = height

# ============================================================
# 引擎设置（O.engines）
# ============================================================

O.engines = [
    # 1. 力重置器：每个时间步开始时清除所有颗粒上的力和力矩
    ForceResetter(),

    # 2. 碰撞检测器：使用 InsertionSort 算法检测可能接触的颗粒对
    #    Bo1_Sphere_Aabb：球体的包围盒
    #    Bo1_Wall_Aabb：平面墙的包围盒
    InsertionSortCollider([Bo1_Sphere_Aabb(), Bo1_Wall_Aabb()]),

    # 3. 相互作用循环：处理颗粒间的接触
    #    Ig2：交互几何（计算接触几何量）
    #    Ip2：交互物理（计算接触物理参数）
    #    Law2：本构定律（计算接触力）
    InteractionLoop(
        [Ig2_Sphere_Sphere_ScGeom(),    # 球-球接触几何
         Ig2_Wall_Sphere_ScGeom()],      # 墙-球接触几何
        [Ip2_FrictMat_FrictMat_FrictPhys()],  # 摩擦材料的接触物理
        [Law2_ScGeom_FrictPhys_CundallStrack()]  # Cundall-Strack 摩擦本构
    ),

    # 4. 牛顿积分器：根据合力和力矩更新颗粒的位置和速度
    #    damping：局部阻尼，用于耗散动能（准静态模拟需要较大阻尼）
    NewtonIntegrator(damping=dampingCoeff),

    # 5. 数据采集：定期记录模拟数据
    PyRunner(iterPeriod=200, command='collectData()'),

    # 6. 加载控制：定期检查应变并调整加载
    PyRunner(iterPeriod=500, command='checkLoading()'),
]

# ============================================================
# 数据采集函数
# ============================================================

def collectData():
    """
    采集并记录应力-应变数据。
    每隔一定时间步调用一次。

    计算方法：
    - 轴向应变 ε = 1 - H/H0
    - 轴向应力 σ = |F_top| / A（顶部墙竖向力除以截面积）
    - 侧向应力估算（用于计算 K0）
    """
    # 获取当前试样高度
    z_top = O.bodies[wallTopId].state.pos[2]
    z_bot = O.bodies[wallBotId].state.pos[2]
    currentHeight = z_top - z_bot

    # 计算轴向应变（正值表示压缩）
    axialStrain = 1.0 - currentHeight / initialHeight

    # 获取顶部墙的竖向力
    # O.forces.f(bodyId) 返回作用在该 body 上的合力矢量
    F_top = O.forces.f(wallTopId)
    axialForce = abs(F_top[2])  # 取 z 分量的绝对值

    # 计算轴向应力
    axialStress = axialForce / crossSectionArea

    # 估算侧向应力（K0 测量）
    # 方法：统计侧向边界颗粒上的平均法向力
    lateralStress = estimateLateralStress()

    # 计算 K0 值（侧向应力与竖向应力之比）
    if axialStress > 1e-3:  # 避免除以零
        K0 = lateralStress / axialStress
    else:
        K0 = 0.0

    # 计算配位数（平均每个颗粒的接触数）
    coordNum = computeCoordinationNumber()

    # 记录数据到 plot 模块
    plot.addData(
        iter=O.iter,              # 当前迭代步数
        strain=axialStrain,        # 轴向应变
        stress=axialStress,        # 轴向应力 [Pa]
        lateralStress=lateralStress,  # 侧向应力 [Pa]
        K0=K0,                     # K0 值
        height=currentHeight,      # 当前试样高度 [m]
        coordNum=coordNum,         # 配位数
        unbalanced=utils.unbalancedForce()  # 不平衡力（判断收敛）
    )


def estimateLateralStress():
    """
    估算侧向应力。

    方法：遍历侧向边界颗粒，累加其法向接触力的水平分量，
    然后除以侧向边界面积。

    返回：侧向应力的平均值 [Pa]
    """
    totalLateralForce = 0.0
    contactCount = 0

    for i in sphereIds:
        b = O.bodies[i]
        if b is None or not isinstance(b.shape, Sphere):
            continue
        pos = b.state.pos
        x, y = pos[0], pos[1]

        # 检查是否为侧向边界颗粒
        isXBoundary = (x < boundaryTol) or (x > width - boundaryTol)
        isYBoundary = (y < boundaryTol) or (y > depth - boundaryTol)

        if isXBoundary or isYBoundary:
            # 获取该颗粒的接触力
            for inter in b.intrs():
                if not inter.isReal:
                    continue
                # 接触法向力
                normalForce = inter.phys.normalForce
                # 取水平分量的大小
                lateralF = (normalForce[0]**2 + normalForce[1]**2)**0.5
                totalLateralForce += lateralF
                contactCount += 1

    # 侧向面积估算：试样周长 × 当前高度
    z_top = O.bodies[wallTopId].state.pos[2]
    z_bot = O.bodies[wallBotId].state.pos[2]
    currentHeight = z_top - z_bot
    perimeter = 2 * (width + depth)
    lateralArea = perimeter * currentHeight

    if lateralArea > 0 and contactCount > 0:
        return totalLateralForce / lateralArea
    else:
        return 0.0


def computeCoordinationNumber():
    """
    计算配位数（Coordination Number）。

    配位数 = 2 × 接触数 / 颗粒数
    对于稳定堆积，配位数通常在 4 ~ 7 之间。
    """
    totalContacts = 0
    totalSpheres = 0

    for i in sphereIds:
        b = O.bodies[i]
        if b is None or not isinstance(b.shape, Sphere):
            continue
        totalSpheres += 1
        # 统计该颗粒的真实接触数
        for inter in b.intrs():
            if inter.isReal:
                totalContacts += 1

    # 每个接触被两个颗粒共享，所以除以 2
    if totalSpheres > 0:
        return totalContacts / totalSpheres  # 注意：这里每个接触算了两次
    else:
        return 0.0


def checkLoading():
    """
    检查当前应变水平，控制加载过程。
    """
    z_top = O.bodies[wallTopId].state.pos[2]
    z_bot = O.bodies[wallBotId].state.pos[2]
    currentHeight = z_top - z_bot
    axialStrain = 1.0 - currentHeight / initialHeight

    # 达到目标应变时停止模拟
    if axialStrain >= maxStrain:
        print(f"达到目标应变 {maxStrain*100:.1f}%，模拟结束")
        if plot.data.get('K0'):
            print(f"最终 K0 值: {plot.data['K0'][-1]:.3f}")
        if plot.data.get('stress'):
            print(f"最终轴向应力: {plot.data['stress'][-1]:.0f} Pa")
        O.pause()


# ============================================================
# 初始压实阶段（重力沉积）
# ============================================================

# 在正式加载之前，先让颗粒在重力作用下沉积，形成自然堆积
# 这样可以获得更真实的初始状态

# 设置重力加速度
O.dt = PWaveTimeStep()  # 使用 P 波时间步估算器设置安全时间步

print("\n=== 阶段 1：重力沉积 ===")
print("正在等待颗粒沉积到稳定状态...")

# ============================================================
# 绘图设置
# ============================================================

# 定义绘图数据
# plots 字典的键为 x 轴数据，值为 y 轴数据列表
plot.plots = {
    'strain': ('stress',),           # 应力-应变曲线
    'iter': ('K0',),                 # K0 随迭代步的变化
    'strain': ('lateralStress',),    # 侧向应力-应变曲线
    'iter': ('coordNum',),           # 配位数变化
}

# 重置已有的绘图数据
plot.resetData()

# ============================================================
# 施加压缩荷载
# ============================================================

def startCompression():
    """
    开始一维压缩加载。
    设置顶部墙的向下速度。
    """
    print(f"\n=== 阶段 2：一维压缩 ===")
    print(f"加载速率: {abs(loadingRate)*1000:.1f} mm/s")
    print(f"目标应变: {maxStrain*100:.1f}%")
    print(f"初始试样高度: {initialHeight*1000:.1f} mm")

    # 设置顶部墙的速度（向下移动，负 z 方向）
    O.bodies[wallTopId].state.vel = Vector3(0, 0, loadingRate)


# ============================================================
# 主程序入口
# ============================================================

# 先运行一段时间进行重力沉积
O.run(20000, True)  # 运行 20000 步（阻塞模式，等待完成）

print("\n重力沉积完成")
print(f"当前不平衡力: {utils.unbalancedForce():.4f}")

# 重新记录初始高度（沉积后颗粒堆积会降低高度）
z_top = O.bodies[wallTopId].state.pos[2]
z_bot = O.bodies[wallBotId].state.pos[2]
initialHeight = z_top - z_bot
print(f"沉积后试样高度: {initialHeight*1000:.1f} mm")

# 重置绘图数据（沉积阶段的数据不需要）
plot.resetData()

# 开始压缩加载
startCompression()

# 设置新的数据采集引擎（压缩阶段更频繁地采集）
O.engines += [
    PyRunner(iterPeriod=100, command='collectData()'),
    PyRunner(iterPeriod=500, command='checkLoading()'),
]

# 运行模拟直到达到目标应变
print("\n模拟运行中...")
print("达到目标应变时自动停止")

O.run(500000, True)

print(f"\n=== 模拟结束 ===")
print(f"最终 K0 值: {plot.data['K0'][-1]:.3f}" if plot.data.get('K0') else "")
print(f"最终轴向应力: {plot.data['stress'][-1]:.0f} Pa" if plot.data.get('stress') else "")

# ============================================================
# 模拟结束后的后处理（在 Python 交互环境中执行）
# ============================================================

# 取消以下注释以保存数据和图像：

# # 保存应力-应变数据到文件
# plot.saveGnuplot('/tmp/oedometric_stress_strain')
#
# # 显示最终的应力-应变曲线
# import matplotlib.pyplot as plt
# fig, axes = plt.subplots(1, 3, figsize=(15, 5))
#
# # 应力-应变曲线
# axes[0].plot(plot.data['strain'], plot.data['stress'], 'b-', linewidth=2)
# axes[0].set_xlabel('轴向应变 ε_a')
# axes[0].set_ylabel('轴向应力 σ_a [Pa]')
# axes[0].set_title('应力-应变曲线')
# axes[0].grid(True)
#
# # K0 值变化
# axes[1].plot(plot.data['strain'], plot.data['K0'], 'r-', linewidth=2)
# axes[1].set_xlabel('轴向应变 ε_a')
# axes[1].set_ylabel('K0 = σ_h / σ_v')
# axes[1].set_title('K0 值变化')
# axes[1].grid(True)
#
# # 配位数变化
# axes[2].plot(plot.data['strain'], plot.data['coordNum'], 'g-', linewidth=2)
# axes[2].set_xlabel('轴向应变 ε_a')
# axes[2].set_ylabel('配位数 Z')
# axes[2].set_title('配位数变化')
# axes[2].grid(True)
#
# plt.tight_layout()
# plt.savefig('/tmp/oedometric_results.png', dpi=150)
# plt.show()

quit()

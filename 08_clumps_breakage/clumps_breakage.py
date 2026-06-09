# -*- coding: utf-8 -*-
"""
团簇与破碎模拟 —— 非球形颗粒 (Clump) 生成、堆积与破碎
======================================================

本脚本演示 YADE 中 Clump 的创建和使用：
  阶段 1：创建不同形状的 Clump（哑铃形、L 形、三角形）
  阶段 2：重力沉积形成 Clump 堆积
  阶段 3：压缩加载，观察 Clump 的力学行为
  阶段 4：颗粒破碎 —— 将受力过大的 Clump 替换为独立球体

运行方式：
    yadedaily clumps_breakage.py
"""

# ============================================================
# 导入模块
# ============================================================
from yade import pack, plot, utils
from yade.utils import Vector3
import math
import random

# ============================================================
# 参数定义
# ============================================================

# --- 材料参数 ---
young = 1e7             # 杨氏模量 [Pa]
poisson = 0.3           # 泊松比
frictionAngle = 0.6     # 摩擦角 [rad]（约 34°）
density = 2600          # 颗粒密度 [kg/m³]

# --- Clump 参数 ---
numClumps = 60          # Clump 数量
sizeMin = 0.010         # Clump 最小尺寸 [m]
sizeMax = 0.020         # Clump 最大尺寸 [m]

# --- 容器参数 ---
containerWidth = 0.20   # 容器宽度 [m]
containerDepth = 0.20   # 容器深度 [m]
containerHeight = 0.30  # 容器高度 [m]
wallThickness = 0.005   # 墙壁厚度 [m]

# --- 破碎参数 ---
breakForce = 500.0      # 破碎力阈值 [N]
                        # 当 Clump 上的总接触力超过此值时，Clump 破碎

# --- 加载参数 ---
loadingRate = -0.05     # 顶部墙加载速率 [m/s]，负值表示向下压缩

# --- 阻尼参数 ---
dampingCoeff = 0.3      # 局部阻尼系数（Clump 模拟通常需要较大阻尼）

# --- 数据采集参数 ---
dataInterval = 200       # 数据采集间隔

# ============================================================
# Clump 形状模板定义
# ============================================================
# 每个模板由一系列 (相对位置, 相对半径) 定义
# 相对位置以模板的"特征尺寸"为单位
# 所有 Clump 都通过缩放模板来创建

# --- 模板 1：哑铃形 (Dumbbell) ---
# 两个球体沿 z 轴排列，部分重叠
dumbbellTemplate = [
    (Vector3(0, 0, -0.4), 0.5),     # 下球
    (Vector3(0, 0,  0.4), 0.5),     # 上球
]

# --- 模板 2：L 形 ---
# 三个球体呈 L 形排列
lShapeTemplate = [
    (Vector3(0, 0, 0), 0.5),        # 角部球
    (Vector3(0.7, 0, 0), 0.5),      # 水平臂
    (Vector3(0, 0, 0.7), 0.5),      # 垂直臂
]

# --- 模板 3：三角形 ---
# 三个球体呈等边三角形排列
triangleTemplate = [
    (Vector3(0, 0, 0), 0.5),                           # 顶点 1
    (Vector3(0.7, 0, 0), 0.5),                         # 顶点 2
    (Vector3(0.35, 0, 0.35 * math.sqrt(3)), 0.5),      # 顶点 3
]

# --- 模板 4：直线形 (棒状) ---
# 三个球体沿一条直线排列
rodTemplate = [
    (Vector3(0, 0, -0.7), 0.5),    # 一端
    (Vector3(0, 0, 0), 0.5),       # 中间
    (Vector3(0, 0, 0.7), 0.5),     # 另一端
]

# 将所有模板收集到列表中
allTemplates = [dumbbellTemplate, lShapeTemplate, triangleTemplate, rodTemplate]
templateNames = ['哑铃形', 'L 形', '三角形', '棒状']

print("可用的 Clump 形状模板:")
for i, name in enumerate(templateNames):
    print(f"  {i}: {name} ({len(allTemplates[i])} 个球体)")

# ============================================================
# 材料定义
# ============================================================

O.materials.append(FrictMat(
    young=young,
    poisson=poisson,
    frictionAngle=frictionAngle,
    density=density,
    label='mat'
))

# ============================================================
# 创建容器
# ============================================================

# 使用 Box 创建一个无盖的容器
# 底面
wallBot = O.bodies.append(box(
    center=[containerWidth / 2, containerDepth / 2, -wallThickness / 2],
    extents=[containerWidth / 2 + wallThickness, containerDepth / 2 + wallThickness, wallThickness / 2],
    fixed=True, color=[0.5, 0.5, 0.5]
))

# 四面侧壁
# x 方向左侧壁
wallX0 = O.bodies.append(box(
    center=[-wallThickness / 2, containerDepth / 2, containerHeight / 2],
    extents=[wallThickness / 2, containerDepth / 2 + wallThickness, containerHeight / 2],
    fixed=True, color=[0.5, 0.5, 0.5]
))

# x 方向右侧壁
wallX1 = O.bodies.append(box(
    center=[containerWidth + wallThickness / 2, containerDepth / 2, containerHeight / 2],
    extents=[wallThickness / 2, containerDepth / 2 + wallThickness, containerHeight / 2],
    fixed=True, color=[0.5, 0.5, 0.5]
))

# y 方向前侧壁
wallY0 = O.bodies.append(box(
    center=[containerWidth / 2, -wallThickness / 2, containerHeight / 2],
    extents=[containerWidth / 2 + wallThickness, wallThickness / 2, containerHeight / 2],
    fixed=True, color=[0.5, 0.5, 0.5]
))

# y 方向后侧壁
wallY1 = O.bodies.append(box(
    center=[containerWidth / 2, containerDepth + wallThickness / 2, containerHeight / 2],
    extents=[containerWidth / 2 + wallThickness, wallThickness / 2, containerHeight / 2],
    fixed=True, color=[0.5, 0.5, 0.5]
))

# 顶部加载墙（初始位置在容器上方）
wallTop = O.bodies.append(box(
    center=[containerWidth / 2, containerDepth / 2, containerHeight + wallThickness / 2],
    extents=[containerWidth / 2, containerDepth / 2, wallThickness / 2],
    fixed=True, dynamic=True, color=[0.8, 0.2, 0.2]
))

print("容器已创建")

# ============================================================
# 创建 Clump 颗粒
# ============================================================

# 存储 Clump 信息，用于后续破碎处理
# 格式: {clump_body_id: {'template': [...], 'memberIds': [...], 'templateIdx': int}}
clumpInfo = {}

# 使用固定随机种子以保证可复现性
random.seed(42)

print(f"\n正在创建 {numClumps} 个 Clump...")

for i in range(numClumps):
    # 随机选择模板
    templateIdx = random.randint(0, len(allTemplates) - 1)
    template = allTemplates[templateIdx]

    # 随机位置（在容器内部）
    cx = random.uniform(sizeMax, containerWidth - sizeMax)
    cy = random.uniform(sizeMax, containerDepth - sizeMax)
    cz = containerHeight * 0.5 + random.uniform(0, containerHeight * 0.4)

    center = Vector3(cx, cy, cz)

    # 随机缩放
    size = random.uniform(sizeMin, sizeMax)

    # 创建成员球体列表
    memberBodies = []
    for localPos, relRadius in template:
        # 将相对位置和半径缩放到实际大小
        globalPos = center + localPos * size
        actualRadius = relRadius * size
        memberBodies.append(sphere(globalPos, actualRadius, color=[random.random(), random.random(), random.random()]))

    # 使用 appendClumped 创建 Clump
    # 返回值: (clumpId, [memberId1, memberId2, ...])
    clumpId, memberIds = O.bodies.appendClumped(memberBodies)

    # 记录 Clump 信息
    clumpInfo[clumpId] = {
        'template': template,
        'memberIds': memberIds,
        'templateIdx': templateIdx,
        'size': size,
        'center': center,
    }

    if (i + 1) % 20 == 0:
        print(f"  已创建 {i + 1} / {numClumps} 个 Clump")

print(f"已创建 {len(clumpInfo)} 个 Clump")

# 统计各形状的数量
shapeCounts = [0] * len(allTemplates)
for info in clumpInfo.values():
    shapeCounts[info['templateIdx']] += 1
for name, count in zip(templateNames, shapeCounts):
    print(f"  {name}: {count} 个")

# ============================================================
# 引擎管线设置
# ============================================================

O.engines = [
    # 步骤 1：力清零
    ForceResetter(),

    # 步骤 2：碰撞检测
    InsertionSortCollider([Bo1_Sphere_Aabb(), Bo1_Box_Aabb()]),

    # 步骤 3：接触力计算
    InteractionLoop(
        [Ig2_Sphere_Sphere_ScGeom(), Ig2_Box_Sphere_ScGeom()],
        [Ip2_FrictMat_FrictMat_FrictPhys()],
        [Law2_ScGeom_FrictPhys_CundallStrack()]
    ),

    # 步骤 4：运动积分
    # Clump 的旋转由 NewtonIntegrator 自动处理
    NewtonIntegrator(damping=dampingCoeff, gravity=(0, 0, -9.81)),

    # 步骤 5：数据采集
    PyRunner(iterPeriod=dataInterval, command='collectData()'),

    # 步骤 6：状态监控
    PyRunner(iterPeriod=3000, command='printStatus()'),

    # 步骤 7：破碎检测
    PyRunner(iterPeriod=500, command='checkBreakage()'),
]

# ============================================================
# 全局变量
# ============================================================

# 仿真阶段控制
phase = 'deposition'    # 'deposition'（沉积）或 'compression'（压缩）

# 破碎计数
nBroken = 0             # 已破碎的 Clump 数量
brokenIds = []          # 已破碎的 Clump ID 列表

# 力-位移数据
maxForce = 0.0          # 历史最大接触力
wallDisplacement = 0.0  # 顶部墙位移

# 床层高度与压缩控制
bedTopZ = 0.0                        # 沉积后床层最高点 z 坐标
compressionStartZ = containerHeight + wallThickness / 2  # 压缩起始墙位置
compressionSteps = 0                 # 压缩阶段已运行步数
prevTopForce = 0.0                   # 上次检测时的顶部力（用于检测力突降）
peakForce = 0.0                      # 压缩过程中的峰值力

# ============================================================
# 数据采集函数
# ============================================================

def collectData():
    """
    采集模拟数据。
    """
    global maxForce, wallDisplacement

    # 计算颗粒系统的总动能
    totalKE = 0.0
    for b in O.bodies:
        if isinstance(b.shape, Sphere):
            m = b.state.mass
            v = b.state.vel.norm()
            totalKE += 0.5 * m * v * v

    # 计算平均配位数
    totalContacts = 0
    totalParticles = 0
    for b in O.bodies:
        if isinstance(b.shape, Sphere):
            totalParticles += 1
            for inter in b.intrs():
                if inter.isReal:
                    totalContacts += 1
    coordNum = totalContacts / totalParticles if totalParticles > 0 else 0

    # 顶部墙位置和力
    topPos = O.bodies[wallTop].state.pos[2]
    topForce = abs(O.forces.f(wallTop)[2])

    # 顶部墙位移（相对于压缩起始位置）
    wallDisplacement = compressionStartZ - topPos

    # 更新最大力
    if topForce > maxForce:
        maxForce = topForce

    plot.addData(
        iter=O.iter,
        time=O.time,
        kineticEnergy=totalKE,
        coordNum=coordNum,
        nBroken=nBroken,
        topForce=topForce,
        wallDisp=wallDisplacement,
        maxForce=maxForce,
    )


def printStatus():
    """打印当前状态"""
    topPos = O.bodies[wallTop].state.pos[2]
    topForce = abs(O.forces.f(wallTop)[2])
    disp = compressionStartZ - topPos

    if phase == 'compression':
        print(f"  阶段: {phase} | "
              f"步骤: {compressionSteps:>6d} | "
              f"iter: {O.iter:>8d} | "
              f"顶部力: {topForce:>8.1f} N | "
              f"位移: {disp * 1000:>6.1f} mm | "
              f"破碎数: {nBroken:>3d} | "
              f"不平衡力: {utils.unbalancedForce():>6.4f}")
    else:
        print(f"  阶段: {phase} | "
              f"iter: {O.iter:>8d} | "
              f"顶部力: {topForce:>8.1f} N | "
              f"破碎数: {nBroken:>3d} | "
              f"不平衡力: {utils.unbalancedForce():>6.4f}")


# ============================================================
# 破碎检测与处理函数
# ============================================================

def checkBreakage():
    """
    检测并处理 Clump 破碎。

    破碎判据：当 Clump 上的总接触力超过 breakForce 时，
    将 Clump 替换为独立的成员球体。
    """
    global nBroken

    if phase != 'compression':
        return  # 仅在压缩阶段检测破碎

    # 遍历所有 Clump
    clumpsToBreak = []

    for clumpId in list(clumpInfo.keys()):
        b = O.bodies[clumpId]
        if b is None:
            continue

        # 计算 Clump 上的总力
        totalForce = O.forces.f(clumpId).norm()

        # 同时计算成员球体上的力（更准确）
        memberForceSum = 0.0
        for mid in clumpInfo[clumpId]['memberIds']:
            memberForceSum += O.forces.f(mid).norm()

        # 破碎判据
        if memberForceSum > breakForce:
            clumpsToBreak.append(clumpId)

    # 处理破碎
    for clumpId in clumpsToBreak:
        replaceClumpWithSpheres(clumpId)
        nBroken += 1

    if clumpsToBreak:
        print(f"  *** 发生 {len(clumpsToBreak)} 次破碎！总破碎数: {nBroken} ***")


def replaceClumpWithSpheres(clumpId):
    """
    将一个 Clump 替换为独立的成员球体。

    这是破碎模拟的核心函数。步骤：
    1. 保存 Clump 的运动状态（位置、速度、角速度、朝向）
    2. 删除 Clump
    3. 在相同位置创建独立球体
    4. 赋予球体适当的速度（Clump 线速度 + 旋转贡献）
    """
    global clumpInfo, brokenIds

    if clumpId not in clumpInfo:
        return

    info = clumpInfo[clumpId]
    b = O.bodies[clumpId]

    if b is None:
        return

    # 保存 Clump 的运动状态
    clumpPos = b.state.pos          # 质心位置
    clumpVel = b.state.vel          # 质心线速度
    clumpAngVel = b.state.angVel    # 角速度
    clumpOri = b.state.ori          # 旋转四元数
    clumpSize = info['size']
    template = info['template']

    # 记录成员球体的旧 ID（将在删除 Clump 时一起被删除）
    oldMemberIds = list(info['memberIds'])

    # 删除 Clump（同时删除所有成员球体）
    O.bodies.erase(clumpId, True)  # eraseClumpMembers=True

    # 创建独立的成员球体
    newMemberIds = []
    for localPos, relRadius in template:
        # 将局部坐标转换为全局坐标
        # 全局位置 = Clump 质心 + 旋转(局部位置 × 缩放)
        globalPos = clumpPos + clumpOri * (localPos * clumpSize)
        actualRadius = relRadius * clumpSize

        # 计算成员球体的速度
        # v = V_cm + ω × r_local（旋转对速度的贡献）
        localScaled = localPos * clumpSize
        rotVel = clumpAngVel.cross(clumpOri * localScaled)
        memberVel = clumpVel + rotVel

        # 创建球体（颜色随机以区分）
        newId = O.bodies.append(sphere(
            globalPos, actualRadius,
            color=[random.random() * 0.5 + 0.3,
                   random.random() * 0.5 + 0.3,
                   random.random() * 0.5 + 0.3]
        ))

        # 赋予速度
        O.bodies[newId].state.vel = memberVel

        newMemberIds.append(newId)

    # 更新记录
    brokenIds.extend(newMemberIds)
    del clumpInfo[clumpId]


# ============================================================
# 阶段切换函数
# ============================================================

def switchToCompression():
    """
    从沉积阶段切换到压缩阶段。
    测量床层高度，将顶部墙定位到床层上方，并开始向下压缩。
    """
    global phase, bedTopZ, compressionStartZ

    phase = 'compression'

    # 测量实际床层高度：所有球体的最高 z 坐标
    maxZ = 0.0
    for b in O.bodies:
        if isinstance(b.shape, Sphere):
            topZ = b.state.pos[2] + b.shape.radius
            if topZ > maxZ:
                maxZ = topZ
    bedTopZ = maxZ
    print(f"\n床层最高点: {bedTopZ * 1000:.1f} mm")

    # 将顶部墙放置在床层上方，留出小间隙
    gap = 0.005  # 5 mm 间隙
    compressionStartZ = bedTopZ + gap
    wallBody = O.bodies[wallTop]
    wallBody.state.pos = Vector3(
        containerWidth / 2,
        containerDepth / 2,
        compressionStartZ
    )
    wallBody.state.vel = Vector3(0, 0, loadingRate)

    print(f"顶部墙初始位置: {compressionStartZ * 1000:.1f} mm")
    print(f"目标压缩量: {bedTopZ * 0.3 * 1000:.1f} mm (床层高度的 30%)")
    print(f"加载速率: {abs(loadingRate) * 1000:.1f} mm/s")
    print(f"破碎力阈值: {breakForce:.0f} N")


# ============================================================
# 绘图设置
# ============================================================

plot.plots = {
    # 图 1：顶部力 vs 位移
    'wallDisp': ('topForce',),

    # 图 2：动能变化
    'time ': ('kineticEnergy',),

    # 图 3：破碎数量
    'time  ': ('nBroken',),

    # 图 4：配位数
    'time   ': ('coordNum',),
}

plot.resetData()

# ============================================================
# 设置时间步长并运行
# ============================================================

O.dt = PWaveTimeStep()

print("\n" + "=" * 60)
print("团簇与破碎模拟")
print("=" * 60)
print(f"Clump 数量: {numClumps}")
print(f"尺寸范围: {sizeMin * 1000:.1f} ~ {sizeMax * 1000:.1f} mm")
print(f"容器尺寸: {containerWidth * 1000:.0f} × {containerDepth * 1000:.0f} × {containerHeight * 1000:.0f} mm")
print(f"破碎力阈值: {breakForce:.0f} N")
print(f"时间步长: {O.dt:.6e} s")
print("=" * 60)

# ============================================================
# 阶段 1：重力沉积
# ============================================================

print("\n--- 阶段 1：重力沉积 ---")
print("正在等待 Clump 沉积到容器底部...")

# 运行沉积阶段
# Clump 在重力作用下下落并堆积在容器底部
O.run(30000, True)  # 阻塞运行 30000 步

print(f"\n沉积完成！")
print(f"不平衡力: {utils.unbalancedForce():.4f}")

# ============================================================
# 阶段 2：压缩加载
# ============================================================

print("\n--- 阶段 2：压缩加载 ---")

# 切换到压缩阶段（会测量床层高度并重新定位顶部墙）
switchToCompression()

# 压缩阶段终止条件参数
chunkSteps = 5000            # 每次阻塞运行的步数
maxSteps = 200000            # 压缩阶段最大步数
targetDisp = bedTopZ * 0.30  # 目标位移：床层高度的 30%
forceThreshold = breakForce * 2  # 力突降检测阈值

print(f"\n正在压缩中...")
print(f"终止条件: 位移 >= {targetDisp * 1000:.1f} mm | "
      f"步数 >= {maxSteps} | "
      f"力突降检测 (峰值力的 50%)")

try:
    while compressionSteps < maxSteps:
        # 阻塞运行一组步数（PyRunner 回调在运行期间自动执行）
        O.run(chunkSteps, True)
        compressionSteps += chunkSteps

        # 获取当前状态
        topPos = O.bodies[wallTop].state.pos[2]
        topForce = abs(O.forces.f(wallTop)[2])
        disp = compressionStartZ - topPos

        # 更新峰值力
        if topForce > peakForce:
            peakForce = topForce

        # ---- 终止条件 1：达到目标位移 ----
        if disp >= targetDisp:
            O.pause()
            print(f"\n*** 达到目标位移: {disp * 1000:.1f} mm >= "
                  f"{targetDisp * 1000:.1f} mm ***")
            break

        # ---- 终止条件 2：力突降（指示破碎事件） ----
        if prevTopForce > forceThreshold and topForce < prevTopForce * 0.5:
            O.pause()
            print(f"\n*** 检测到力突降: {prevTopForce:.1f} -> {topForce:.1f} N "
                  f"(可能发生破碎) ***")
            break

        prevTopForce = topForce

    else:
        # while 循环正常结束（达到 maxSteps）
        O.pause()
        print(f"\n*** 达到最大步数限制: {maxSteps} ***")

except KeyboardInterrupt:
    O.pause()
    print("\n*** 用户中断 ***")

print("\n" + "=" * 60)
print("模拟完成！")
print("=" * 60)
finalTopPos = O.bodies[wallTop].state.pos[2]
finalDisp = compressionStartZ - finalTopPos
print(f"总迭代步数: {O.iter}")
print(f"压缩步数: {compressionSteps}")
print(f"顶部墙位移: {finalDisp * 1000:.2f} mm")
print(f"压缩比: {finalDisp / bedTopZ * 100:.1f}% (相对于床层高度)")
print(f"床层高度: {bedTopZ * 1000:.1f} mm")
print(f"破碎 Clump 数: {nBroken}")
print(f"峰值力: {peakForce:.1f} N")
print("=" * 60)

quit()

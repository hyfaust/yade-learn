# -*- coding: utf-8 -*-
"""
球体堆积技术演示（Sphere Packing Techniques）- YADE 离散元演示
================================================================

本脚本演示 YADE 中各种球体堆积生成技术：
- 方法 1：makeCloud 随机堆积
- 方法 2：randomDensePack 密实堆积
- 方法 3：regularHexa 六方堆积
- 方法 4：regularOrtho 正交堆积
- 方法 5：谓词布尔运算
- 方法 6：PSD（粒径分布）控制
- 方法 7：堆积保存与加载

运行方式：
    yadedaily sphere_packing.py
"""

# ============================================================
# 导入必要的 YADE 模块
# ============================================================
from yade import pack, plot, utils, qt
from yade.utils import Vector3
import math
import os

# ============================================================
# 通用参数
# ============================================================

# 颗粒材料参数
young = 5e6           # 杨氏模量 [Pa]
poisson = 0.3         # 泊松比
frictionAngle = 0.5   # 摩擦角 [rad]
density = 2600        # 密度 [kg/m³]

# 颗粒参数
rMean = 0.003         # 平均半径 [m]
rRelFuzz = 0.3        # 半径分散度

# 区域尺寸
boxSize = 0.05        # 盒子边长 [m]

# 临时文件目录
tmpDir = '/tmp/yade_packing_demo'
os.makedirs(tmpDir, exist_ok=True)

# ============================================================
# 辅助函数
# ============================================================

def calcPorosity(sphereIds, containerVolume):
    """
    计算孔隙率。

    参数：
        sphereIds：球体颗粒的 ID 列表
        containerVolume：容器（区域）的体积

    返回：
        孔隙率 n = 1 - V_spheres / V_container
    """
    # 计算颗粒总体积
    V_spheres = 0.0
    for i in sphereIds:
        b = O.bodies[i]
        if b is not None and isinstance(b.shape, Sphere):
            r = b.shape.radius
            V_spheres += (4.0 / 3.0) * math.pi * r**3

    # 孔隙率 = 1 - 颗粒体积 / 容器体积
    porosity = 1.0 - V_spheres / containerVolume
    return porosity


def calcCoordinationNumber(sphereIds):
    """
    计算配位数（平均每个颗粒的接触数）。

    配位数 Z = 2 × 接触数 / 颗粒数
    对于稳定堆积，Z 通常在 4 ~ 7 之间。
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

    if totalSpheres > 0:
        # 每个接触被两个颗粒共享，所以除以颗粒数（不是 2×颗粒数）
        return totalContacts / totalSpheres
    return 0.0


def printPackingInfo(title, sphereIds, containerVolume):
    """
    打印堆积的基本信息。
    """
    porosity = calcPorosity(sphereIds, containerVolume)
    nSpheres = len(sphereIds)

    # 计算平均半径
    radii = [O.bodies[i].shape.radius for i in sphereIds
             if O.bodies[i] is not None and isinstance(O.bodies[i].shape, Sphere)]
    avgRadius = sum(radii) / len(radii) if radii else 0

    # 配位数（需要先运行几步让颗粒接触）
    O.run(100, True)  # 运行 100 步建立接触
    coordNum = calcCoordinationNumber(sphereIds)

    print(f"\n{'=' * 50}")
    print(f"堆积方法: {title}")
    print(f"{'=' * 50}")
    print(f"  颗粒数量:    {nSpheres}")
    print(f"  平均半径:    {avgRadius*1000:.3f} mm")
    print(f"  孔隙率:      {porosity:.4f}")
    print(f"  配位数:      {coordNum:.2f}")
    print(f"  容器体积:    {containerVolume*1e6:.2f} cm³")
    print(f"{'=' * 50}")

    return porosity


def clearBodies():
    """
    清除模拟中的所有颗粒，为下一次演示做准备。
    """
    O.bodies.clear()
    O.interactions.clear()


# ============================================================
# 材料定义
# ============================================================

O.materials.append(FrictMat(
    young=young,
    poisson=poisson,
    frictionAngle=frictionAngle,
    density=density
))

# 设置基本引擎（所有演示共用）
O.engines = [
    ForceResetter(),
    InsertionSortCollider([Bo1_Sphere_Aabb()]),
    InteractionLoop(
        [Ig2_Sphere_Sphere_ScGeom()],
        [Ip2_FrictMat_FrictMat_FrictPhys()],
        [Law2_ScGeom_FrictPhys_CundallStrack()]
    ),
    NewtonIntegrator(damping=0.7),  # 高阻尼用于快速沉积
]

O.dt = PWaveTimeStep()

# ============================================================
# 存储所有演示的结果用于对比
# ============================================================
results = {}

# ============================================================
# 方法 1：makeCloud 随机堆积
# ============================================================

print("\n" + "#" * 60)
print("# 方法 1：makeCloud 随机堆积")
print("#" * 60)

# makeCloud 是最简单的堆积生成方法
# 它在指定区域内随机放置球体，不考虑重叠
# 生成后需要运行模拟让颗粒在重力下沉积以消除重叠

# 定义生成区域
containerVolume = boxSize**3

# 生成随机球体堆积
sp1 = pack.SpherePack()
sp1.makeCloud(
    minCorner=Vector3(0, 0, 0),           # 区域最小角点
    maxCorner=Vector3(boxSize, boxSize, boxSize),  # 区域最大角点
    rMean=rMean,      # 平均半径
    rRelFuzz=rRelFuzz, # 半径分散度
    num=500,          # 目标颗粒数量
    periodic=False,   # 非周期性边界
    seed=42           # 随机种子（可复现）
)

# 添加底部墙用于沉积
wallBot = utils.wall(position=0, axis=2, sense=1)
wallBotId = O.bodies.append(wallBot)

# 将球体添加到模拟
ids1 = sp1.toSimulation()

# 运行沉积（高阻尼，快速稳定）
print("正在沉积颗粒...")
O.run(5000, True)

# 采集结果
results['makeCloud'] = printPackingInfo('makeCloud 随机堆积', ids1, containerVolume)

# 清除颗粒，准备下一次演示
clearBodies()

# ============================================================
# 方法 2：randomDensePack 密实堆积
# ============================================================

print("\n" + "#" * 60)
print("# 方法 2：randomDensePack 密实堆积")
print("#" * 60)

# randomDensePack 使用沉积法生成密实堆积
# 它比 makeCloud 更慢，但生成的堆积更紧密
# 通过 memoizeDb 可以缓存结果，避免重复计算

# 定义谓词（堆积区域）
predicate = pack.inAlignedBox(
    (0, 0, 0),
    (boxSize, boxSize, boxSize)
)

# 生成密实堆积
# 注意：randomDensePack 会自动创建临时模拟进行沉积
sp2 = pack.randomDensePack(
    predicate,                              # 空间谓词
    radius=rMean,                           # 平均半径
    rRelFuzz=rRelFuzz,                      # 半径分散度
    memoizeDb=f'{tmpDir}/dense_pack.db',    # 缓存数据库
    seed=42,                                # 随机种子
    returnSpherePack=True                   # 返回 SpherePack 对象
)

# 添加底部墙
wallBot = utils.wall(position=0, axis=2, sense=1)
wallBotId = O.bodies.append(wallBot)

# 添加到模拟
ids2 = sp2.toSimulation()

# 运行几步建立接触
O.run(200, True)

results['randomDensePack'] = printPackingInfo('randomDensePack 密实堆积', ids2, containerVolume)

clearBodies()

# ============================================================
# 方法 3：手动生成六方最密堆积 (HCP)
# ============================================================

print("\n" + "#" * 60)
print("# 方法 3：六方最密堆积 (HCP)")
print("#" * 60)

# 手动生成 HCP 堆积
# HCP 堆积的理论堆积密度约 74%（孔隙率约 26%）
# HCP 堆积结构：交替层，每层相对于上一层偏移

sp3 = pack.SpherePack()

# 计算网格参数
spacing = 2.1 * rMean  # 颗粒间距（略大于直径，避免初始重叠）

# 生成 HCP 堆积
# HCP 堆积：xy 平面是六方排列，z 方向交替偏移
coords = []
nx = int(boxSize / spacing)
ny = int(boxSize / spacing)
nz = int(boxSize / spacing)

for iz in range(nz):
    for iy in range(ny):
        for ix in range(nx):
            # 基础位置
            x = ix * spacing
            y = iy * spacing
            z = iz * spacing

            # 六方排列：奇数行偏移半个间距
            if iy % 2 == 1:
                x += spacing * 0.5

            # 交替层偏移
            if iz % 2 == 1:
                x += spacing * 0.5
                y += spacing * 0.5 / math.sqrt(3)

            # 检查是否在盒子内
            if 0 <= x < boxSize and 0 <= y < boxSize and 0 <= z < boxSize:
                coords.append((Vector3(x, y, z), rMean))

sp3.fromList(coords)

# 添加底部墙
wallBot = utils.wall(position=0, axis=2, sense=1)
wallBotId = O.bodies.append(wallBot)

# 添加到模拟
ids3 = sp3.toSimulation()

O.run(100, True)

results['regularHexa'] = printPackingInfo('六方最密堆积 (HCP)', ids3, containerVolume)

clearBodies()

# ============================================================
# 方法 4：手动生成正交堆积（简单立方）
# ============================================================

print("\n" + "#" * 60)
print("# 方法 4：正交堆积（简单立方）")
print("#" * 60)

# 手动生成简单立方堆积
# 理论堆积密度约 52%（孔隙率约 48%）
# 结构简单，便于分析

sp4 = pack.SpherePack()

# 计算网格参数
spacing_ortho = 2.1 * rMean  # 颗粒间距

# 生成正交堆积
coords4 = []
nx4 = int(boxSize / spacing_ortho)
ny4 = int(boxSize / spacing_ortho)
nz4 = int(boxSize / spacing_ortho)

for iz in range(nz4):
    for iy in range(ny4):
        for ix in range(nx4):
            x = ix * spacing_ortho
            y = iy * spacing_ortho
            z = iz * spacing_ortho

            # 检查是否在盒子内
            if 0 <= x < boxSize and 0 <= y < boxSize and 0 <= z < boxSize:
                coords4.append((Vector3(x, y, z), rMean))

sp4.fromList(coords4)

# 添加底部墙
wallBot = utils.wall(position=0, axis=2, sense=1)
wallBotId = O.bodies.append(wallBot)

ids4 = sp4.toSimulation()

O.run(100, True)

results['regularOrtho'] = printPackingInfo('regularOrtho 正交堆积', ids4, containerVolume)

clearBodies()

# ============================================================
# 方法 5：谓词布尔运算
# ============================================================

print("\n" + "#" * 60)
print("# 方法 5：谓词布尔运算（复杂几何形状）")
print("#" * 60)

# 谓词支持布尔运算：| (并集)、& (交集)、- (差集)
# 可以组合出各种复杂几何形状

# --- 示例 5a：空心圆柱体 ---
print("\n--- 5a：空心圆柱体内的堆积 ---")
print("    外径 25mm，内径 10mm，高度 50mm")

# 外圆柱减去内圆柱 = 空心圆柱
hollow_cylinder = (
    pack.inCylinder(
        (0, 0, 0),          # 底面中心
        (0, 0, 0.05),       # 顶面中心
        0.025                # 外半径
    ) -
    pack.inCylinder(
        (0, 0, 0),
        (0, 0, 0.05),
        0.01                 # 内半径
    )
)

sp5a = pack.SpherePack()
sp5a.makeCloud(
    minCorner=Vector3(-0.03, -0.03, 0),    # 区域最小角点（足够大以覆盖圆柱体）
    maxCorner=Vector3(0.03, 0.03, 0.05),   # 区域最大角点
    rMean=0.002,
    rRelFuzz=0.3,
    num=800
)

# 添加底部墙
wallBot = utils.wall(position=0, axis=2, sense=1)
wallBotId = O.bodies.append(wallBot)

# 从 SpherePack 中筛选位于空心圆柱内的颗粒
# 使用 toList() 获取所有颗粒，然后过滤
allSpheres = sp5a.toList()
filteredSpheres = []
for (center, radius) in allSpheres:
    x, y, z = center
    r_xy = math.sqrt(x**2 + y**2)
    if 0.01 < r_xy < 0.025 and 0 <= z <= 0.05:
        filteredSpheres.append((center, radius))

# 创建新的 SpherePack 只包含筛选后的颗粒
sp5a_filtered = pack.SpherePack()
sp5a_filtered.fromList(filteredSpheres)

# 添加到模拟
ids5a = sp5a_filtered.toSimulation()

# 运行沉积
print("正在沉积颗粒到空心圆柱中...")
O.run(3000, True)

# 空心圆柱体积
hollow_cyl_volume = math.pi * (0.025**2 - 0.01**2) * 0.05
printPackingInfo('空心圆柱体', ids5a, hollow_cyl_volume)

clearBodies()

# --- 示例 5b：两个球体的并集（哑铃形区域）---
print("\n--- 5b：哑铃形区域内的堆积 ---")

dumbbell = (
    pack.inSphere((0.015, 0.025, 0.025), 0.015) |
    pack.inSphere((0.035, 0.025, 0.025), 0.015)
)

sp5b = pack.SpherePack()
sp5b.makeCloud(
    minCorner=Vector3(0, 0, 0),
    maxCorner=Vector3(0.05, 0.05, 0.05),
    rMean=0.0015,
    rRelFuzz=0.3,
    num=600
)

# 添加底部墙
wallBot = utils.wall(position=0, axis=2, sense=1)
wallBotId = O.bodies.append(wallBot)

# 从 SpherePack 中筛选位于哑铃形区域内的颗粒
allSpheres5b = sp5b.toList()
filteredSpheres5b = []
for (center, radius) in allSpheres5b:
    x, y, z = center
    # 检查是否在任一个球体内
    d1 = math.sqrt((x-0.015)**2 + (y-0.025)**2 + (z-0.025)**2)
    d2 = math.sqrt((x-0.035)**2 + (y-0.025)**2 + (z-0.025)**2)
    if d1 < 0.015 or d2 < 0.015:
        filteredSpheres5b.append((center, radius))

# 创建新的 SpherePack 只包含筛选后的颗粒
sp5b_filtered = pack.SpherePack()
sp5b_filtered.fromList(filteredSpheres5b)

# 添加到模拟
ids5b = sp5b_filtered.toSimulation()

print("正在沉积颗粒到哑铃形区域中...")
O.run(3000, True)

# 两个球的总体积
dumbbell_volume = 2 * (4.0/3.0) * math.pi * 0.015**3
printPackingInfo('哑铃形区域', ids5b, dumbbell_volume)

clearBodies()

# ============================================================
# 方法 6：PSD（粒径分布）控制
# ============================================================

print("\n" + "#" * 60)
print("# 方法 6：PSD（粒径分布）控制")
print("#" * 60)

# PSD 控制允许指定颗粒集合体的粒径分布
# 这对于模拟真实工程材料（如砂土、碎石）非常重要

# --- 示例 6a：自定义 PSD ---
print("\n--- 6a：自定义三段级配 ---")

# 先生成一个基本的 SpherePack
sp6a = pack.SpherePack()
sp6a.makeCloud(
    minCorner=Vector3(0, 0, 0),
    maxCorner=Vector3(boxSize, boxSize, boxSize),
    rMean=rMean,
    rRelFuzz=0.8,      # 大分散度，产生较宽的粒径分布
    num=800,
    periodic=False
)

# 注意：此版本的 SpherePack.psd() 仅支持查询粒径分布，不支持设置
# 使用较大的 rRelFuzz 来产生自然的粒径分布

# 添加底部墙
wallBot = utils.wall(position=0, axis=2, sense=1)
wallBotId = O.bodies.append(wallBot)

ids6a = sp6a.toSimulation()

print("正在沉积颗粒（宽粒径分布）...")
O.run(5000, True)

results['customPSD'] = printPackingInfo('宽粒径分布', ids6a, containerVolume)

# 统计粒径分布
radii = [O.bodies[i].shape.radius for i in ids6a
         if O.bodies[i] is not None and isinstance(O.bodies[i].shape, Sphere)]
if radii:
    print(f"  最小半径:    {min(radii)*1000:.4f} mm")
    print(f"  最大半径:    {max(radii)*1000:.4f} mm")
    print(f"  半径比:      {max(radii)/min(radii):.1f}")

clearBodies()

# --- 示例 6b：单分散（等径颗粒）---
print("\n--- 6b：单分散（等径颗粒）---")

sp6b = pack.SpherePack()
sp6b.makeCloud(
    minCorner=Vector3(0, 0, 0),
    maxCorner=Vector3(boxSize, boxSize, boxSize),
    rMean=rMean,
    rRelFuzz=0.0,      # rRelFuzz=0 表示所有颗粒半径相同
    num=500,
    periodic=False
)

wallBot = utils.wall(position=0, axis=2, sense=1)
wallBotId = O.bodies.append(wallBot)

ids6b = sp6b.toSimulation()

print("正在沉积颗粒（单分散）...")
O.run(5000, True)

results['monodisperse'] = printPackingInfo('单分散（等径）', ids6b, containerVolume)

clearBodies()

# --- 示例 6c：双分散（大小颗粒混合）---
print("\n--- 6c：双分散（大小颗粒混合）---")

sp6c = pack.SpherePack()
sp6c.makeCloud(
    minCorner=Vector3(0, 0, 0),
    maxCorner=Vector3(boxSize, boxSize, boxSize),
    rMean=rMean,
    rRelFuzz=0.6,      # 较大分散度，产生大小颗粒混合
    num=500,
    periodic=False
)

wallBot = utils.wall(position=0, axis=2, sense=1)
wallBotId = O.bodies.append(wallBot)

ids6c = sp6c.toSimulation()

print("正在沉积颗粒（双分散）...")
O.run(5000, True)

results['bidisperse'] = printPackingInfo('双分散（大小混合）', ids6c, containerVolume)

clearBodies()

# ============================================================
# 方法 7：堆积保存与加载
# ============================================================

print("\n" + "#" * 60)
print("# 方法 7：堆积保存与加载")
print("#" * 60)

# SpherePack 可以保存到文件，方便后续重用
# 支持文本格式（.txt）和二进制格式（.bin）

# 生成一个堆积用于演示
sp7 = pack.SpherePack()
sp7.makeCloud(
    minCorner=Vector3(0, 0, 0),
    maxCorner=Vector3(boxSize, boxSize, boxSize),
    rMean=rMean,
    rRelFuzz=rRelFuzz,
    num=300,
    periodic=False
)

# 保存为文本格式（可读，但文件较大）
txtFile = f'{tmpDir}/packing_demo.txt'
sp7.save(txtFile)
print(f"已保存文本格式堆积: {txtFile}")

# 保存为二进制格式（更紧凑）
binFile = f'{tmpDir}/packing_demo.bin'
sp7.save(binFile)
print(f"已保存二进制格式堆积: {binFile}")

# 从文件加载
sp7_loaded = pack.SpherePack()
sp7_loaded.load(txtFile)
print(f"从文本文件加载: {len(sp7_loaded.toList())} 个颗粒")

sp7_loaded2 = pack.SpherePack()
sp7_loaded2.load(binFile)
print(f"从二进制文件加载: {len(sp7_loaded2.toList())} 个颗粒")

# 使用 fromSimulation 从当前模拟提取堆积
wallBot = utils.wall(position=0, axis=2, sense=1)
wallBotId = O.bodies.append(wallBot)
ids7 = sp7.toSimulation()
O.run(500, True)

# 提取当前模拟中的球体
sp7_extracted = pack.SpherePack()
sp7_extracted.fromSimulation()
print(f"从模拟提取: {len(sp7_extracted.toList())} 个颗粒")

# 保存提取的堆积
extractedFile = f'{tmpDir}/packing_extracted.bin'
sp7_extracted.save(extractedFile)
print(f"已保存提取的堆积: {extractedFile}")

clearBodies()

# ============================================================
# 方法 8：圆柱体内的堆积
# ============================================================

print("\n" + "#" * 60)
print("# 方法 8：圆柱体内的堆积")
print("#" * 60)

# 使用 inCylinder 谓词在圆柱体内生成堆积
# 这在模拟三轴试验等圆柱形试样时非常有用

cylinderRadius = 0.02   # 圆柱半径 [m]
cylinderHeight = 0.04   # 圆柱高度 [m]

# 定义圆柱体谓词
cylinderPred = pack.inCylinder(
    (0, 0, 0),                          # 底面中心
    (0, 0, cylinderHeight),             # 顶面中心
    cylinderRadius                       # 半径
)

# 使用 randomDensePack 在圆柱体内生成密实堆积
sp8 = pack.randomDensePack(
    cylinderPred,
    radius=0.002,
    rRelFuzz=0.3,
    memoizeDb=f'{tmpDir}/cylinder_pack.db',
    seed=42,
    returnSpherePack=True
)

# 添加底部墙
wallBot = utils.wall(position=0, axis=2, sense=1)
wallBotId = O.bodies.append(wallBot)

ids8 = sp8.toSimulation()

print("正在沉积颗粒到圆柱体中...")
O.run(200, True)

# 圆柱体体积
cylVolume = math.pi * cylinderRadius**2 * cylinderHeight
results['cylinder'] = printPackingInfo('圆柱体密实堆积', ids8, cylVolume)

clearBodies()

# ============================================================
# 方法 9：周期性边界堆积
# ============================================================

print("\n" + "#" * 60)
print("# 方法 9：周期性边界堆积")
print("#" * 60)

# 周期性堆积用于周期性边界条件的模拟
# 颗粒在盒子边缘会被自动"映射"到对面

O.periodic = True
O.cell.refSize = Vector3(boxSize, boxSize, boxSize)

sp9 = pack.SpherePack()
sp9.makeCloud(
    minCorner=Vector3(0, 0, 0),
    maxCorner=Vector3(boxSize, boxSize, boxSize),
    rMean=rMean,
    rRelFuzz=rRelFuzz,
    num=500,
    periodic=True   # 关键：periodic=True
)

ids9 = sp9.toSimulation()

# 周期性堆积不需要底部墙
# 直接运行让系统稳定
O.run(500, True)

# 计算孔隙率
periodicVolume = boxSize**3
V_spheres = sum(
    (4.0/3.0) * math.pi * O.bodies[i].shape.radius**3
    for i in ids9
    if O.bodies[i] is not None and isinstance(O.bodies[i].shape, Sphere)
)
porosity = 1.0 - V_spheres / periodicVolume

print(f"\n{'=' * 50}")
print(f"堆积方法: 周期性边界 makeCloud")
print(f"{'=' * 50}")
print(f"  颗粒数量:    {len(ids9)}")
print(f"  孔隙率:      {porosity:.4f}")
print(f"  盒子尺寸:    {boxSize*1000:.1f} mm³")
print(f"  周期性:      是")
print(f"{'=' * 50}")

# 关闭周期性边界（恢复默认）
O.periodic = False

clearBodies()

# ============================================================
# 结果对比汇总
# ============================================================

print("\n")
print("=" * 60)
print("        各种堆积方法的孔隙率对比")
print("=" * 60)
print(f"{'堆积方法':<25s} {'孔隙率':>10s}")
print("-" * 60)

for method, porosity in results.items():
    print(f"{method:<25s} {porosity:>10.4f}")

print("-" * 60)
print("注：规则堆积（Hexa/Ortho）的孔隙率是理论值")
print("    随机堆积的孔隙率取决于颗粒数量和分散度")
print("=" * 60)

# ============================================================
# 保存对比图（可选）
# ============================================================

# 取消以下注释以使用 matplotlib 绘制对比图：

# import matplotlib.pyplot as plt
#
# fig, ax = plt.subplots(figsize=(10, 6))
# methods = list(results.keys())
# porosities = list(results.values())
# colors = ['steelblue', 'coral', 'gold', 'green', 'purple',
#           'brown', 'pink', 'gray']
#
# bars = ax.bar(methods, porosities, color=colors[:len(methods)])
# ax.set_ylabel('孔隙率')
# ax.set_title('不同堆积方法的孔隙率对比')
# ax.set_ylim(0, 0.6)
#
# # 在柱状图上方标注数值
# for bar, poro in zip(bars, porosities):
#     ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01,
#             f'{poro:.3f}', ha='center', va='bottom')
#
# plt.xticks(rotation=45, ha='right')
# plt.tight_layout()
# plt.savefig(f'{tmpDir}/packing_comparison.png', dpi=150)
# plt.show()

print("\n演示完成！")
print(f"临时文件保存在: {tmpDir}")

quit()

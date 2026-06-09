# -*- coding: utf-8 -*-
"""
02 重力沉降 —— 多颗粒仿真入门
========================================
场景：200+ 个随机球体在重力作用下落入一个无盖方形容器，
经历碰撞和沉降后最终达到准静态平衡。
同时使用 PyRunner 和 plot 模块记录并绘制沉降曲线。

运行方式：
    yadedaily gravity_deposition.py

输出文件：
    gravity_deposition.png  —— 沉降过程曲线图（接触数、动能随时间变化）
"""

from yade import pack, plot
from yade.utils import Vector3

# ============================================================
# 第一部分：定义数据记录函数
# ============================================================
# 这个函数会被 PyRunner 周期性调用，记录仿真过程中的关键物理量

def recordData():
    """记录仿真数据：时间、迭代步数、接触数、动能"""
    plot.addData(
        t=O.time,                            # 当前仿真时间 (秒)
        i=O.iter,                            # 当前迭代步数
        numContacts=len(O.interactions),      # 当前活跃接触数
        kineticEnergy=kineticEnergy()         # 系统总动能 (J)
    )

# ============================================================
# 第二部分：材料设置
# ============================================================
# 定义默认材料为 FrictMat（摩擦材料）
#   young         : 杨氏模量 (Pa)，决定材料刚度
#   poisson       : 泊松比 (无量纲)，决定横向变形特性
#   frictionAngle : 摩擦角 (rad)，决定颗粒间摩擦力大小
#   density       : 密度 (kg/m³)，接近砂石密度

O.materials.append(FrictMat(
    young=1e7,                    # 10 MPa，适中的刚度
    poisson=0.3,                  # 泊松比 0.3
    frictionAngle=radians(30),    # 摩擦角 30°（转为弧度）
    density=2600,                 # 密度 2600 kg/m³
    label='defaultMat'
))

# ============================================================
# 第三部分：创建容器（5 面墙壁，顶部开口）
# ============================================================
# 容器内部空间：x ∈ [0, 5], y ∈ [0, 5], z ∈ [0, 5]

# 底面 —— 灰色
O.bodies.append(box(
    center=[2.5, 2.5, -0.05],       # 中心位置
    extents=[2.55, 2.55, 0.05],     # 半尺寸（比内部稍大以避免缝隙）
    fixed=True,                      # 固定不动
    color=[0.6, 0.6, 0.6]           # 灰色
))

# 左墙 (x=0 面) —— 红色调
O.bodies.append(box(
    center=[-0.05, 2.5, 2.5],
    extents=[0.05, 2.55, 2.55],
    fixed=True,
    color=[0.8, 0.4, 0.4]
))

# 右墙 (x=5 面) —— 红色调
O.bodies.append(box(
    center=[5.05, 2.5, 2.5],
    extents=[0.05, 2.55, 2.55],
    fixed=True,
    color=[0.8, 0.4, 0.4]
))

# 前墙 (y=0 面) —— 绿色调
O.bodies.append(box(
    center=[2.5, -0.05, 2.5],
    extents=[2.55, 0.05, 2.55],
    fixed=True,
    color=[0.4, 0.8, 0.4]
))

# 后墙 (y=5 面) —— 绿色调
O.bodies.append(box(
    center=[2.5, 5.05, 2.5],
    extents=[2.55, 0.05, 2.55],
    fixed=True,
    color=[0.4, 0.8, 0.4]
))

# ============================================================
# 第四部分：使用 SpherePack 生成随机球体
# ============================================================

# 创建 SpherePack 实例（独立于仿真的球体数据结构）
sp = pack.SpherePack()

# 在容器上方区域随机生成 200 个球体
#   cornerMin = (0, 0, 0.5)   ：区域最低点（高于容器底部，留出缓冲）
#   cornerMax = (5, 5, 9)     ：区域最高点（容器内部 + 上方空间）
#   rMean     = 0.3           ：平均半径 0.3 m
#   rRelFuzz  = 0.5           ：半径浮动 50%（实际半径范围约 0.15~0.45）
#   num       = 200           ：生成 200 个球体
sp.makeCloud(
    minCorner=Vector3(0, 0, 0.5),
    maxCorner=Vector3(5, 5, 9),
    rMean=0.3,
    rRelFuzz=0.5,
    num=200
)

# 将 SpherePack 中的球体转移到当前仿真场景中
# 每个球体会被添加到 O.bodies 中，获得默认材料属性
sp.toSimulation()

print(f"已生成 {len(sp)} 个球体并添加到仿真中")

# ============================================================
# 第五部分：引擎管线 (Engine Pipeline)
# ============================================================
# 与教程 01 结构相同，但：
#   - 阻尼增大到 0.4，帮助多体系统更快趋于平衡
#   - 新增 PyRunner 用于周期性记录数据

O.engines = [
    # 步骤 1：力的清零
    ForceResetter(),

    # 步骤 2：碰撞检测（粗筛）
    # Bo1_Sphere_Aabb()：球体的包围盒生成
    # Bo1_Box_Aabb()：方块的包围盒生成
    InsertionSortCollider([Bo1_Sphere_Aabb(), Bo1_Box_Aabb()]),

    # 步骤 3：接触力计算
    InteractionLoop(
        # Ig2：接触几何判断
        [Ig2_Sphere_Sphere_ScGeom(),     # 球-球接触
         Ig2_Box_Sphere_ScGeom()],       # 壁-球接触
        # Ip2：接触物理参数
        [Ip2_FrictMat_FrictMat_FrictPhys()],
        # Law2：本构律（力的计算）
        [Law2_ScGeom_FrictPhys_CundallStrack()]
    ),

    # 步骤 4：运动积分
    # damping=0.4：40% 局部阻尼，多体系统需要更强的阻尼来快速收敛
    # gravity：标准地球重力
    NewtonIntegrator(damping=0.4, gravity=(0, 0, -9.81)),

    # 步骤 5：数据记录（每 500 步执行一次 recordData() 函数）
    PyRunner(command='recordData()', iterPeriod=500),
]

# ============================================================
# 第六部分：配置绘图
# ============================================================
# plot.plots 定义要绘制的图表
#   键 = x 轴变量，值 = y 轴变量的元组
#   键名加空格表示创建新图（否则覆盖同一张图）

plot.plots = {
    't': ('numContacts',),       # 图 1：接触数 vs 时间
    't ': ('kineticEnergy',)     # 图 2：动能 vs 时间（注意 't ' 中的空格）
}

# ============================================================
# 第七部分：设置时间步长并运行仿真
# ============================================================

# 时间步长取 PWaveTimeStep 的 50%
# 比教程 01（0.2%）大得多，因为沉降过程不需要精确捕捉高速碰撞
# 主要目的是确保仿真稳定且高效
O.dt = 0.5 * PWaveTimeStep()

print("开始运行仿真...")
print(f"时间步长: {O.dt:.6e} s")
print(f"总步数: 200000")
print(f"预计仿真时间: {200000 * O.dt:.2f} s")

# 运行 200,000 个时间步
O.run(200000, True)

print("仿真完成！")

# ============================================================
# 第八部分：保存绘图结果
# ============================================================

# 绘制并保存图表（不弹出窗口）
fig = plot.plot(noShow=True)
fig.savefig('gravity_deposition.png', dpi=150)

print("图表已保存为 gravity_deposition.png")
print(f"最终接触数: {len(O.interactions)}")
print(f"系统动能: {kineticEnergy():.6e} J")

quit()

# 02 重力沉降 —— 多颗粒仿真入门

## 1. 项目简介

本项目是 YADE DEM 学习系列的第二个教程。在上一个教程中，我们学习了单个球体的
弹跳运动。本教程将把这个场景扩展到**大量球体**的仿真，模拟**重力沉降**
(gravity deposition) 过程：

- 创建一个**无盖容器**（由 5 面墙壁构成的方形箱子）
- 使用 `SpherePack` 工具**随机生成 200+ 个球体**，分布在容器上方
- 在重力作用下，所有球体自由下落并相互碰撞
- 球体逐渐堆积在容器底部，最终达到准静态平衡
- 使用 `PyRunner` 和 `plot` 模块**实时记录数据**并绘制沉降曲线

通过本教程，你将掌握：
- `SpherePack` 类及其 `makeCloud()` 方法：批量生成随机球体堆积
- `toSimulation()` 方法：将 SpherePack 转移到仿真场景中
- `yade.plot` 模块：仿真数据记录与绘图
- `PyRunner`：周期性 Python 回调函数
- 多体碰撞的包围盒 (AABB) 检测机制
- 颗粒沉降与力链 (force chain) 的物理概念

---

## 2. 核心概念详解

### 2.1 SpherePack —— 球体堆积工具

`SpherePack` 是 YADE 提供的一个**实用工具类**，用于生成和操作球体的随机堆积。
它的关键特点是：

- **独立于仿真**：SpherePack 可以在不启动仿真的情况下生成球体集合。它只是一个
  数据结构，存储了球体的位置和半径信息。
- **可复用**：同一个 SpherePack 可以多次导入不同的仿真场景中。
- **支持多种生成方式**：随机生成、规则排列、从文件导入等。

```python
from yade import pack

# 创建 SpherePack 实例
sp = pack.SpherePack()
```

### 2.2 makeCloud() —— 随机生成球体

`makeCloud()` 是 SpherePack 最常用的方法，用于在指定区域内随机生成球体：

```python
sp.makeCloud(
    cornerMin=(0, 0, 0),      # 区域最小角点 (x_min, y_min, z_min)
    cornerMax=(5, 5, 10),      # 区域最大角点 (x_max, y_max, z_max)
    rMean=0.3,                 # 球体平均半径
    rRelFuzz=0.5,              # 半径相对浮动系数 (0~1)
    num=200,                   # 生成球体数量
    periodic=False             # 是否使用周期性边界
)
```

**参数详解**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `cornerMin` | tuple(x,y,z) | 生成区域的最小角坐标 |
| `cornerMax` | tuple(x,y,z) | 生成区域的最大角坐标 |
| `rMean` | float | 球体的平均半径 |
| `rRelFuzz` | float | 半径的相对浮动范围。实际半径 r = rMean * (1 ± rRelFuzz * random) |
| `num` | int | 生成的球体数量 |
| `periodic` | bool | 是否使用周期性边界（True 时球体可跨越边界） |

**关于 rRelFuzz**：
- `rRelFuzz = 0`：所有球体半径相同（单分散系统）
- `rRelFuzz = 0.5`：半径在 rMean 的 50% 范围内波动（多分散系统）
- `rRelFuzz = 1`：半径最大可能为 2 倍 rMean（注意：不能为负，所以实际范围不对称）

**注意**：`makeCloud()` 生成的球体之间可能有重叠。这些重叠会在仿真开始后被
接触力自动推开。如果初始重叠过大，可能需要降低时间步长或增大阻尼来避免发散。

### 2.3 toSimulation() —— 转移到仿真场景

`SpherePack` 生成的球体只是数据，需要通过 `toSimulation()` 方法将它们添加到
当前仿真中：

```python
sp.toSimulation()
```

执行后，SpherePack 中的所有球体会被依次添加到 `O.bodies` 中，成为可以参与
仿真计算的 Body 对象。每个球体都会自动获得默认的 Material 属性。

**返回值**：`toSimulation()` 返回一个列表，包含所有新添加的 Body 的 ID。

```python
ids = sp.toSimulation()
print(f"添加了 {len(ids)} 个球体")
print(f"ID 范围：{ids[0]} ~ {ids[-1]}")
```

### 2.4 数据记录与绘图 —— yade.plot 模块

YADE 内置了 `plot` 模块，用于在仿真过程中记录数据和绘制图表。这是分析仿真
结果的重要工具。

#### 2.4.1 plot.addData() —— 添加数据点

在仿真运行过程中，通过调用 `plot.addData()` 记录当前时刻的物理量：

```python
plot.addData(
    t=O.time,                    # 当前仿真时间
    numContacts=len(O.interactions),  # 接触数量
    kineticEnergy=kineticEnergy()     # 系统总动能
)
```

每次调用会在内部数据表中添加一行。参数名会成为列名（如 't'、'numContacts'）。

#### 2.4.2 plot.plots —— 定义绘图配置

通过 `plot.plots` 字典定义要绘制的图表：

```python
plot.plots = {
    't': ('numContacts',),           # x 轴为 t，y 轴为 numContacts
    't ': ('kineticEnergy',)         # 注意：'t ' 带空格表示新图
}
```

**关键语法**：
- 键是 x 轴变量名
- 值是 y 轴变量名的元组
- 同一个键下可以放多个 y 变量，会画在同一张图上
- **空格技巧**：键名加空格（如 `'t '`）表示创建一张新的图，而不是覆盖原有图

#### 2.4.3 plot.plot() —— 绘制并保存图表

```python
plot.plot()              # 在屏幕上显示图表
plot.plot(noShow=True)   # 不显示窗口，直接返回 Figure 对象
# 保存为文件：
fig = plot.plot(noShow=True)
fig.savefig('output.png')
```

### 2.5 PyRunner —— 周期性 Python 回调

`PyRunner` 是 YADE 中一个非常有用的引擎，它允许在仿真过程中定期执行 Python
代码：

```python
PyRunner(
    command='myFunction()',   # 要执行的 Python 代码（字符串）
    iterPeriod=1000           # 每隔多少个时间步执行一次
)
```

也可以使用 `realPeriod` 按仿真时间间隔触发（单位：秒）：

```python
PyRunner(
    command='myFunction()',
    realPeriod=0.1           # 每 0.1 秒仿真时间执行一次
)
```

**典型用途**：
- 定期记录数据到 `plot`
- 监控仿真状态（动能是否趋近于零）
- 动态调整仿真参数
- 输出中间结果

**注意**：`command` 中的函数名必须是全局作用域中已定义的。建议在脚本顶部先定义
函数，再在 `PyRunner` 中引用它。

### 2.6 多体碰撞检测

当场景中有 N 个物体时，理论上有 $N(N-1)/2$ 种可能的接触对。对于 N=200 的场景，
这意味着约 20,000 个接触对需要检测。但实际在同一时刻，只有少数物体真正接触。

YADE 使用**两阶段碰撞检测策略**来高效处理这个问题：

#### 粗筛阶段 (Broad Phase)

`InsertionSortCollider` 使用 AABB 重叠检测来快速排除不可能接触的物体对：
1. 将每个物体的 AABB 投影到 x、y、z 轴上
2. 使用插入排序算法找出所有区间重叠的物体对
3. 只有 AABB 重叠的物体对才进入下一阶段

#### 精检阶段 (Narrow Phase)

`Ig2_*` Functor 对粗筛阶段产生的候选对进行精确几何检测：
- 计算两个球体圆心之间的距离
- 与半径之和比较，判断是否真正重叠
- 如果重叠，计算重叠量、接触点位置、法向量等

**性能考虑**：
- InsertionSortCollider 的时间复杂度接近 O(n)（物体移动量小时）
- 精检阶段只处理少量候选对
- 这种策略使得百万级颗粒的仿真成为可能

### 2.7 包围盒 (AABB)

**AABB** (Axis-Aligned Bounding Box，轴对齐包围盒) 是碰撞检测中的核心概念：

```
    +------------------+
    |                  |    ← AABB（较大的包围盒）
    |    +-------+     |
    |    | Sphere|     |    ← 实际球体
    |    +-------+     |
    |                  |
    +------------------+
```

- AABB 是一个长方体，其边与坐标轴平行
- 它完全包围物体的 Shape（对于球体，AABB 就是边长等于直径的正方体）
- AABB 比精确几何体更大，但**重叠检测极其简单**：只需比较 3 对坐标值
- `Bo1_Sphere_Aabb()` 负责为球体生成 AABB
- 当球体移动时，AABB 会随之更新（由 `BoundDispatcher` 或 `InsertionSortCollider`
  自动完成）

**为什么 AABB 对球体是正方体？**

球体的 AABB 边长等于 2r（直径），且三个方向的尺寸相同。这是因为 AABB 必须
与坐标轴对齐，无论球体如何旋转，其包围盒始终是同一个正方体。

---

## 3. 代码逐行解析

下面对 `gravity_deposition.py` 脚本进行逐行解析。

### 3.1 导入模块

```python
from yade import pack, plot
```
- `pack`：提供 SpherePack 类，用于批量生成球体
- `plot`：提供数据记录和绘图功能

### 3.2 定义数据记录函数

```python
def recordData():
    plot.addData(
        t=O.time,
        i=O.iter,
        numContacts=len(O.interactions),
        kineticEnergy=kineticEnergy()
    )
```
这个函数在 PyRunner 的每次触发时被调用：
- `O.time`：当前仿真时间（秒）
- `O.iter`：当前迭代步数
- `len(O.interactions)`：当前活跃接触数，反映颗粒间的接触情况
- `kineticEnergy()`：系统总动能，反映运动的剧烈程度

### 3.3 材料设置

```python
O.materials.append(FrictMat(
    young=1e7,
    poisson=0.3,
    frictionAngle=radians(30),
    density=2600,
    label='defaultMat'
))
```
定义默认材料参数：
- `young=1e7`：杨氏模量 10 MPa（适中的刚度）
- `poisson=0.3`：泊松比 0.3
- `frictionAngle=radians(30)`：摩擦角 30°（转换为弧度）
- `density=2600`：密度 2600 kg/m³（接近砂石密度）
- `label='defaultMat'`：材料标签，方便后续引用

### 3.4 创建容器

使用 `box()` 函数创建 5 面墙壁，构成一个顶部开口的容器：

```python
# 底面
O.bodies.append(box(center=[2.5, 2.5, -0.05], extents=[2.55, 2.55, 0.05],
                     fixed=True, color=[0.6, 0.6, 0.6]))
```
底面：中心在 (2.5, 2.5, -0.05)，尺寸 5.1×5.1×0.1

```python
# 四面墙壁
O.bodies.append(box(center=[-0.05, 2.5, 2.5], extents=[0.05, 2.55, 2.55],
                     fixed=True, color=[0.8, 0.4, 0.4]))  # 左墙
O.bodies.append(box(center=[5.05, 2.5, 2.5], extents=[0.05, 2.55, 2.55],
                     fixed=True, color=[0.8, 0.4, 0.4]))  # 右墙
O.bodies.append(box(center=[2.5, -0.05, 2.5], extents=[2.55, 0.05, 2.55],
                     fixed=True, color=[0.4, 0.8, 0.4]))  # 前墙
O.bodies.append(box(center=[2.5, 5.05, 2.5], extents=[2.55, 0.05, 2.55],
                     fixed=True, color=[0.4, 0.8, 0.4]))  # 后墙
```

**注意**：墙壁的尺寸故意比容器内部空间稍大，以确保无间隙。

### 3.5 生成球体

```python
sp = pack.SpherePack()
sp.makeCloud((0, 0, 0.5), (5, 5, 9), rMean=0.3, rRelFuzz=0.5, num=200)
sp.toSimulation()
```
1. 创建 SpherePack 实例
2. 在 5×5×8.5 的区域内随机生成 200 个球体，平均半径 0.3，半径浮动 50%
3. 球体的 z 坐标从 0.5 开始（高于容器底部），确保球体在容器内部
4. 将球体转移到仿真场景中

### 3.6 引擎管线

```python
O.engines = [
    ForceResetter(),
    InsertionSortCollider([Bo1_Sphere_Aabb(), Bo1_Box_Aabb()]),
    InteractionLoop(
        [Ig2_Sphere_Sphere_ScGeom(), Ig2_Box_Sphere_ScGeom()],
        [Ip2_FrictMat_FrictMat_FrictPhys()],
        [Law2_ScGeom_FrictPhys_CundallStrack()]
    ),
    NewtonIntegrator(damping=0.4, gravity=(0, 0, -9.81)),
    PyRunner(command='recordData()', iterPeriod=500),
]
```

与教程 01 的管线相同，但有以下变化：
- `damping=0.4`：增大阻尼（40%），帮助多体系统更快趋于平衡
- 新增 `PyRunner`：每 500 步调用一次 `recordData()` 记录数据

### 3.7 配置绘图

```python
plot.plots = {
    't': ('numContacts',),
    't ': ('kineticEnergy',)
}
```
定义两张图表：
- 图 1：横轴为时间 t，纵轴为接触数 numContacts
- 图 2：横轴为时间 t，纵轴为动能 kineticEnergy

### 3.8 运行仿真

```python
O.dt = 0.5 * PWaveTimeStep()
O.run(200000, True)
```
- 时间步长取 PWaveTimeStep 的 50%（比教程 01 的 0.2% 大得多，因为不需要精确
  弹跳细节，只需平稳沉降）
- 运行 200,000 个时间步

### 3.9 保存结果

```python
fig = plot.plot(noShow=True)
fig.savefig('gravity_deposition.png', dpi=150)
```
将绘图结果保存为 PNG 图片。

---

## 4. 运行与观察

### 4.1 运行方法

```bash
cd 02_gravity_deposition
yadedaily gravity_deposition.py
```

### 4.2 预期行为

1. **初始阶段**（t < 0.5s）：200 个球体在重力作用下加速下落，接触数急剧增加
2. **沉降阶段**（t < 2s）：球体相互碰撞、堆积，动能在碰撞中转化和耗散
3. **趋稳阶段**（t > 2s）：大部分球体接近静止，动能趋近于零，接触数趋于稳定

### 4.3 关键观察指标

#### 接触数 (numContacts)
- 反映颗粒间的接触网络连通性
- 沉降初期快速增加，最终趋于稳定值
- 典型值：200 个球体可产生 400~800 个接触

#### 动能 (kineticEnergy)
- 反映系统运动的剧烈程度
- 初始时为零（静止），沉降过程中达到峰值，最终回落至零
- 如果动能不趋近于零，说明阻尼不够或时间步长过大

#### 力链 (Force Chain) 概念
虽然本教程不直接绘制力链，但理解力链概念非常重要：
- 在准静态颗粒堆积中，接触力并不是均匀分布的
- 力沿着某些特定路径（力链）从顶部传递到底部
- 力链形成树枝状网络结构
- 在 YADE 中按 `d` 键可以可视化力链（力越大，线越粗）

### 4.4 可视化技巧

在 GUI 窗口中：
- 按 `d`：显示接触力力链
- 按 `s`：显示速度矢量
- 按 `b`：显示包围盒
- 按 `w`：线框模式切换
- 按 `Ctrl+S`：截图

---

## 5. 练习题

### 练习 1：改变颗粒数量

将 `num=200` 分别改为 50、500、1000，观察并对比：
- 沉降完成所需的时间
- 最终的接触数量
- 动能曲线的形态

**思考题**：接触数与颗粒数之间大致是什么比例关系？为什么？

### 练习 2：改变摩擦角

将 `frictionAngle=radians(30)` 分别改为 `radians(0)`（光滑颗粒）和
`radians(45)`（粗糙颗粒），观察：

```python
O.materials.append(FrictMat(
    young=1e7,
    poisson=0.3,
    frictionAngle=radians(0),  # 无摩擦！
    density=2600
))
```

**思考题**：
- 摩擦角为 0 时，颗粒堆积的最终形态是什么样的？（提示：想象沙子 vs 水）
- 摩擦角增大时，堆积角度如何变化？

### 练习 3：添加 VTK 输出

在引擎管线中添加 VTKRecorder，将仿真结果保存为 VTK 文件，然后在 ParaView
中进行三维可视化：

```python
O.engines += [
    VTKRecorder(
        iterPeriod=5000,
        fileName='vtk/gravity-',
        recorders=['spheres', 'intr', 'colors']
    )
]
```

**注意**：运行前需要创建 `vtk/` 目录（`mkdir vtk`）。

**进阶挑战**：在 ParaView 中使用 Glyph 过滤器显示球体，并用 Line 表示接触力
（力链可视化）。

---

## 6. 延伸阅读

- [YADE SpherePack 文档](https://yade-dem.org/doc/yade.pack.html)
- [YADE plot 模块文档](https://yade-dem.org/doc/yade.plot.html)
- [颗粒力学基础](https://en.wikipedia.org/wiki/Granular_material)
- Duran, J. (2000). Sands, Powders, and Grains: An Introduction to the Physics
  of Granular Materials. Springer.

---

**上一课**：[01 弹跳球](../01_bouncing_sphere/) —— 单球体弹跳入门

**下一课**：[03 固结试验](../03_oedometric_test/) —— 学习边界加载和应力-应变分析

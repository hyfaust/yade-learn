# 01 弹跳球 —— YADE DEM 入门第一课

## 1. 项目简介

本项目是 YADE DEM (Discrete Element Method, 离散元法) 学习之旅的第一个教程。我们
将创建一个最简单的仿真场景：

- 一个**固定不动的方块** (Box) 作为地面
- 一个**球体** (Sphere) 从高处自由下落
- 球体在重力作用下加速下落，撞击地面后反弹
- 经过多次弹跳，球体最终因阻尼作用而静止在地面上

这个看似简单的场景，实际上完整地展示了 YADE 仿真引擎的核心运作机制：
**物体(Body)** 的创建、**材料(Material)** 的定义、**引擎管线(Engine Pipeline)** 的
配置，以及**时间积分(Time Integration)** 的执行流程。

通过本教程，你将掌握：
- YADE 中 Body（物体）的数据结构 —— 四元组模型
- 仿真引擎管线 (O.engines) 的组成与执行顺序
- Functor（函子）分发机制的命名规则与作用
- 时间步长的选取原则与数值稳定性
- 编写并运行你的第一个 YADE 仿真脚本

---

## 2. DEM 基本原理

### 2.1 什么是离散元法 (DEM)？

离散元法 (Discrete Element Method, DEM) 是一种数值模拟方法，由 Cundall 和 Strack
在 1979 年首次提出。与有限元法 (FEM) 处理连续介质不同，DEM 将研究对象视为由大量
独立的**离散颗粒** (particles) 组成。

DEM 的核心思想可以用三个关键词概括：

1. **颗粒 (Particles)**：每个颗粒都是一个独立的刚体，拥有自己的位置、速度、角速度、
   质量等物理属性。颗粒可以是球体、多面体、簇 (clump) 等几何形状。

2. **接触 (Contacts)**：当两个颗粒发生重叠（或者距离足够近）时，系统会自动检测到
   接触，并根据本构模型 (constitutive law) 计算接触力。接触力通常包含法向弹性力、
   切向摩擦力等分量。

3. **时间积分 (Time Integration)**：在每个时间步 (time step) 中，DEM 按照以下循环
   执行：
   - **检测接触**：判断哪些颗粒之间存在接触
   - **计算接触力**：根据重叠量和本构关系计算力和力矩
   - **求解运动方程**：根据牛顿第二定律 F=ma 更新每个颗粒的加速度、速度和位置
   - **重复**：进入下一个时间步

这个循环在数学上可以表示为：

```
对每个时间步 Δt:
  1. 检测所有颗粒对之间的接触
  2. 对每个接触，计算接触力 (法向力 + 切向力)
  3. 对每个颗粒，计算合力 F = Σ(接触力) + 重力
  4. 对每个颗粒，更新加速度 a = F/m
  5. 对每个颗粒，更新速度 v = v + a·Δt
  6. 对每个颗粒，更新位置 x = x + v·Δt
```

### 2.2 DEM 与连续介质方法的对比

| 特性 | DEM (离散元法) | FEM (有限元法) |
|------|---------------|---------------|
| 基本假设 | 离散颗粒集合 | 连续介质 |
| 适用对象 | 颗粒材料、破碎、大变形 | 固体力学、小变形 |
| 计算量 | 随颗粒数增加而急剧增大 | 取决于网格密度 |
| 自然优势 | 天然处理不连续面、破碎 | 处理连续变形高效 |

### 2.3 YADE 简介

YADE (Yet Another Dynamic Engine) 是一个开源的离散元法仿真框架，使用 C++ 编写核心
引擎，Python 作为脚本语言。它的主要特点包括：

- **高性能**：核心计算用 C++ 实现，支持 OpenMP 多线程并行
- **灵活可扩展**：通过 Python 脚本控制仿真，用户可以方便地定义新模型
- **模块化设计**：引擎管线由可插拔的"引擎" (Engine) 组成
- **丰富的内置模型**：支持球体、多面体、网格面等多种几何形状

---

## 3. 核心概念详解

### 3.1 Body 四元组

在 YADE 中，**Body**（物体）是最基本的仿真单元。每个 Body 由四个部分组成，称为
"四元组" (quartet)：

```
Body
├── Shape    —— 几何形状
├── Material —— 材料属性
├── State    —— 物理状态
└── Bound    —— 包围盒 (AABB)
```

#### 3.1.1 Shape（几何形状）

Shape 定义了物体的几何特征。YADE 内置了多种 Shape 类型：

- **Sphere**：球体，由圆心和半径定义。是 DEM 中最常用的形状，因为球-球接触检测
  非常简单高效（只需比较圆心距与半径之和）。
- **Box**：长方体，由中心点和半尺寸 (extents) 定义。常用于构建容器壁和地面。
- **Facet**：三角面片，由三个顶点定义。常用于构建不规则边界。
- **Polyhedra**：多面体，支持任意凸多面体形状。
- **Clump**：簇，由多个球体粘结而成的刚性团簇，用于模拟不规则颗粒。

在本教程中，我们使用 Sphere 和 Box 两种 Shape：

```python
# 创建球体：sphere(圆心坐标, 半径)
O.bodies.append(sphere([0, 0, 2], 1))

# 创建方块：box(中心坐标, 半尺寸, 是否固定)
O.bodies.append(box(center=[0, 0, 0], extents=[.5, .5, .5], fixed=True))
```

#### 3.1.2 Material（材料属性）

Material 定义了物体的力学材料参数。YADE 中最常用的材料模型是 **FrictMat**
（摩擦材料），包含以下基本参数：

- **young** (杨氏模量, Pa)：材料的弹性刚度，默认 3.0×10⁷ Pa。值越大，材料越硬。
- **poisson** (泊松比)：横向应变与纵向应变的比值，默认 0.5（接近不可压缩）。
- **frictionAngle** (摩擦角, rad)：颗粒间摩擦角，默认 0.5236 rad ≈ 30°。

当两个物体发生接触时，YADE 会根据两个物体的材料参数，通过 `Ip2_FrictMat_FrictMat_
FrictPhys` 计算出接触的力学参数（等效刚度、摩擦系数等）。

#### 3.1.3 State（物理状态）

State 记录了物体当前的运动学状态，包括：

- **pos** (位置)：质心坐标，三维向量 (x, y, z)
- **vel** (速度)：质心线速度，三维向量
- **angVel** (角速度)：绕质心的旋转角速度，三维向量
- **ori** (朝向)：四元数 (quaternion) 表示的旋转状态
- **mass** (质量)：由 Shape 体积和 Material 密度计算得出
- **inertia** (转动惯量)：三维向量，描述物体抵抗旋转的能力

这些状态量在仿真过程中由 NewtonIntegrator 不断更新。

#### 3.1.4 Bound（包围盒）

Bound 是物体的**轴对齐包围盒** (Axis-Aligned Bounding Box, AABB)。它的作用是
加速碰撞检测：

- **AABB** 是一个长方体，完全包围物体的 Shape
- 在碰撞检测的**粗筛阶段** (broad phase)，系统先检查两个物体的 AABB 是否重叠
- 只有 AABB 重叠的物体对，才会进入**精检阶段** (narrow phase) 进行精确的几何接触
  检测
- AABB 由 Bo1_* 类型的 Functor 创建和更新

这个两阶段策略极大地减少了需要进行精确碰撞检测的物体对数量，是 DEM 高效运行的
关键。

### 3.2 O.engines 引擎管线

`O.engines` 是 YADE 仿真的核心——它定义了每个时间步中依次执行的操作序列，称为
"引擎管线" (engine pipeline)。每个时间步，YADE 按顺序执行管线中的每个引擎。

本教程使用的标准管线包含四个引擎：

```python
O.engines = [
    ForceResetter(),                                            # 步骤1: 清零
    InsertionSortCollider([Bo1_Sphere_Aabb(), Bo1_Box_Aabb()]), # 步骤2: 碰撞检测
    InteractionLoop(                                            # 步骤3: 计算接触力
        [Ig2_Sphere_Sphere_ScGeom(), Ig2_Box_Sphere_ScGeom()],
        [Ip2_FrictMat_FrictMat_FrictPhys()],
        [Law2_ScGeom_FrictPhys_CundallStrack()]
    ),
    NewtonIntegrator(damping=0.2, gravity=(0, 0, -9.81))        # 步骤4: 运动积分
]
```

让我们逐一了解每个引擎的职责：

#### 步骤 1：ForceResetter —— 力的清零

**作用**：在每个时间步开始时，将所有物体上的力和力矩清零。

**为什么需要**：力是逐时间步累加的。在计算新的接触力之前，必须先把上一步积累的力
清零，否则力会不断叠加导致发散。这是"从头计算"而非"增量计算"的策略。

#### 步骤 2：InsertionSortCollider —— 碰撞检测

**作用**：检测哪些物体的包围盒 (AABB) 发生了重叠，产生候选接触对。

**工作原理**：
1. 将每个物体的 AABB 投影到 x、y、z 三个坐标轴上，得到三个区间
2. 使用**插入排序**算法（因此得名）找出所有区间重叠的物体对
3. 将这些候选对传递给下一步处理

**为什么用插入排序**：DEM 仿真中，物体每步移动量很小，因此相邻两步的排序结果
变化很小。对于几乎有序的序列，插入排序的时间复杂度接近 O(n)，远优于快速排序等
通用算法。

**参数**：需要提供 Bo1_* Functor 来定义每种形状如何生成 AABB。

#### 步骤 3：InteractionLoop —— 接触力计算

**作用**：对上一步检测出的所有候选接触对，计算精确的接触力。

这个引擎内部完成三个阶段的工作，每个阶段由一组 Functor 驱动：

1. **Ig2_* (Interaction Geometry)**：判断两个物体是否真的接触，并计算几何信息
   （接触点位置、重叠量、法向量等）。仅当 AABB 重叠时才调用。
2. **Ip2_* (Interaction Physics)**：根据两个物体的材料参数，计算接触的力学参数
   （等效刚度、摩擦系数等）。
3. **Law2_* (Constitutive Law)**：根据几何信息和力学参数，计算接触力和力矩。

#### 步骤 4：NewtonIntegrator —— 运动积分

**作用**：根据合力和合力矩，利用牛顿运动定律更新每个物体的位置和速度。

基本更新公式（速度 Verlet 格式）：

```
v(t + Δt/2) = v(t) + F(t)/m · Δt/2       # 半步速度更新
x(t + Δt)   = x(t) + v(t + Δt/2) · Δt     # 位置更新
# 重新计算力 F(t+Δt)
v(t + Δt)   = v(t + Δt/2) + F(t+Δt)/m · Δt/2  # 又半步速度更新
```

**关键参数**：
- **gravity**：全局重力加速度向量，如 (0, 0, -9.81) 表示 z 轴向下
- **damping**：局部非粘性阻尼系数 (0~1)。阻尼模拟了能量耗散，使系统能够趋近
  静态平衡。值越大，能量耗散越快，球体弹跳幅度衰减越快。

### 3.3 Functor 分发机制

YADE 使用 **Functor**（函子/函数对象）来实现"分发" (dispatch)——根据参与接触的
物体类型，自动选择合适的算法。Functor 的命名遵循严格的约定：

```
类型前缀 + 涉及的类名 + 后缀
```

四种 Functor 的命名规则如下：

#### Bo1_* —— Bound Functor（包围盒生成）

| 名称 | 含义 |
|------|------|
| `Bo1_Sphere_Aabb` | 为 Sphere 生成 AABB 包围盒 |
| `Bo1_Box_Aabb` | 为 Box 生成 AABB 包围盒 |

命名解读：**Bo**und → **1**个物体 → **Sphere**形状 → 输出 **Aabb**

#### Ig2_* —— Interaction Geometry Functor（接触几何）

| 名称 | 含义 |
|------|------|
| `Ig2_Sphere_Sphere_ScGeom` | 球-球接触，生成 ScGeom 几何信息 |
| `Ig2_Box_Sphere_ScGeom` | 盒-球接触，生成 ScGeom 几何信息 |

命名解读：**I**nteraction **G**eometry → **2**个物体 → **Sphere**+**Sphere** → 输出
**ScGeom** (Spherically-composite Contact Geometry)

#### Ip2_* —— Interaction Physics Functor（接触力学参数）

| 名称 | 含义 |
|------|------|
| `Ip2_FrictMat_FrictMat_FrictPhys` | 两个 FrictMat 的材料组合 → FrictPhys |

命名解读：**I**nteraction **P**hysics → **2**种材料 → **FrictMat**+**FrictMat** → 输出
**FrictPhys**

#### Law2_* —— Constitutive Law Functor（本构律）

| 名称 | 含义 |
|------|------|
| `Law2_ScGeom_FrictPhys_CundallStrack` | ScGeom + FrictPhys → Cundall-Strack 力学模型 |

命名解读：**Law** → **2**个输入(ScGeom + FrictPhys) → **CundallStrack** 本构模型

Cundall-Strack 模型是最基本的 DEM 接触模型：
- **法向力**：F_n = k_n · δ_n（弹簧模型，δ_n 为重叠量）
- **切向力**：F_t = min(k_t · δ_t, μ · F_n)（弹簧-滑块模型，满足库伦摩擦定律）

### 3.4 时间步长

时间步长 Δt 的选取是 DEM 仿真的关键问题之一：

- **太大**：数值不稳定，仿真发散（颗粒"爆炸"飞出）
- **太小**：计算效率低，仿真推进缓慢

#### 临界时间步长

根据数值稳定性分析，时间步长必须小于系统的**临界时间步长**：

```
Δt_cr = 2 / ω_max
```

其中 ω_max 是系统中所有颗粒的最高固有角频率。对于一个弹簧-质量系统：

```
ω = √(k/m)
```

其中 k 是接触刚度，m 是颗粒质量。因此：

```
Δt_cr = 2 · √(m_min / k_max)
```

即：最轻的颗粒和最硬的接触决定了最大可用时间步长。

#### PWaveTimeStep()

YADE 提供了 `PWaveTimeStep()` 函数自动估算安全时间步长。它计算的是**P 波**
（纵波/压缩波）穿过最小颗粒所需的时间：

```
Δt_pwave = d_min / √(E / ρ)
```

其中 d_min 是最小颗粒直径，E 是杨氏模量，ρ 是密度。

在实际使用中，通常取一个安全系数（如 0.002 或 0.2）：

```python
O.dt = 0.002 * PWaveTimeStep()  # 极其保守
O.dt = 0.2 * PWaveTimeStep()    # 较为高效但仍安全
O.dt = PWaveTimeStep()          # 理论极限，实际中可能不稳定
```

**建议**：初学时使用较小的安全系数（如 0.002），确保仿真稳定。随着经验积累，
可以逐渐增大以提高效率。

---

## 4. 代码逐行解析

下面是对 `bouncing_sphere.py` 脚本的逐行详细解析：

### 4.1 引擎管线设置

```python
O.engines = [
    ForceResetter(),
```
每个时间步开始时，清除所有物体上累积的力和力矩。这是一个"重置"操作，确保每步
的力都是从零开始计算的。

```python
    InsertionSortCollider([Bo1_Sphere_Aabb(), Bo1_Box_Aabb()]),
```
创建碰撞检测器。参数列表中的两个 Functor 告诉系统：
- `Bo1_Sphere_Aabb()`：遇到 Sphere 类型的 Shape 时，用此方法生成 AABB
- `Bo1_Box_Aabb()`：遇到 Box 类型的 Shape 时，用此方法生成 AABB

如果场景中还有其他形状（如 Facet），也需要添加对应的 Bo1 Functor。

```python
    InteractionLoop(
        [Ig2_Sphere_Sphere_ScGeom(), Ig2_Box_Sphere_ScGeom()],
        [Ip2_FrictMat_FrictMat_FrictPhys()],
        [Law2_ScGeom_FrictPhys_CundallStrack()]
    ),
```
接触力计算循环，三个列表分别指定了：
- **Ig2 列表**：如何判断接触并计算几何量。球-球接触和盒-球接触使用不同的 Ig2
  Functor，但输出都是 ScGeom。
- **Ip2 列表**：如何从材料参数计算接触参数。两种 FrictMat 材料组合生成 FrictPhys
  接触属性。
- **Law2 列表**：如何从几何量和接触参数计算接触力。使用经典的 Cundall-Strack
  弹簧-滑块模型。

```python
    NewtonIntegrator(damping=0.2, gravity=(0, 0, -9.81))
]
```
牛顿积分器，负责运动方程求解：
- `damping=0.2`：施加 20% 的局部非粘性阻尼。这种阻尼形式对静止物体不施加阻力，
  只对运动中的物体产生与速度反向的阻尼力，模拟空气阻力和材料内部能量耗散。
- `gravity=(0, 0, -9.81)`：重力加速度，z 轴向下，大小 9.81 m/s²。

### 4.2 创建物体

```python
O.bodies.append(box(center=[0, 0, 0], extents=[.5, .5, .5], fixed=True, color=[1, 0, 0]))
```
创建地面方块：
- `center=[0, 0, 0]`：方块中心位于原点
- `extents=[.5, .5, .5]`：半尺寸为 0.5，所以方块实际尺寸为 1×1×1
- `fixed=True`：将方块固定，不受力和力矩影响（质量设为无穷大）
- `color=[1, 0, 0]`：红色显示（RGB 值，范围 0~1）

```python
O.bodies.append(sphere([0, 0, 2], 1, color=[0, 1, 0]))
```
创建下落球体：
- `[0, 0, 2]`：球心初始位置 (0, 0, 2)，在地面正上方
- `1`：半径为 1。由于地面方块的上表面在 z=0.5，球体下表面在 z=1，所以初始间距
  为 0.5。
- `color=[0, 1, 0]`：绿色显示

### 4.3 时间步长与运行

```python
O.dt = .002 * PWaveTimeStep()
```
设置时间步长。`PWaveTimeStep()` 根据当前场景中最小颗粒和材料参数计算出 P 波
特征时间。乘以 0.002 是一个非常保守的安全系数，保证数值稳定。

```python
O.run(100000, True)
```
执行仿真：
- `100000`：运行 100,000 个时间步
- `True`：阻塞模式，等仿真完成后才继续执行后续 Python 代码

如果 dt = 0.002 * PWaveTimeStep()，总仿真时间约为几百个特征时间，足以让球体
完成多次弹跳并静止。

### 4.4 输出结果

```python
print("仿真结束！球体最终位置：")
print(O.bodies[1].state.pos)
```
仿真结束后，打印球体（body 索引为 1）的最终位置。理论上，球体应停留在 z ≈ 1.5
附近（地面半高 0.5 + 球半径 1）。

---

## 5. 运行与观察

### 5.1 运行方法

在终端中执行：

```bash
cd 01_bouncing_sphere
yadedaily bouncing_sphere.py
```

### 5.2 预期行为

1. 仿真开始后，绿色球体从 (0, 0, 2) 处自由下落
2. 球体以红色方块为地面，发生碰撞并反弹
3. 由于阻尼 (damping=0.2) 的存在，每次弹跳高度逐渐降低
4. 经过多次弹跳后，球体趋于静止
5. 终端输出球体的最终位置坐标

### 5.3 可视化

YADE 自带 OpenGL 可视化窗口（如果编译时启用了）。运行时会弹出一个窗口，你可以：

- **鼠标左键拖动**：旋转视角
- **鼠标滚轮**：缩放
- **鼠标右键拖动**：平移
- 按 `d` 键可以显示接触力链
- 按 `s` 键可以显示速度矢量

如果在无图形界面的服务器上运行，可以添加 `--nogui` 参数：

```bash
yadedaily --nogui bouncing_sphere.py
```

### 5.4 调试技巧

- **修改阻尼值**：将 damping 设为 0（无阻尼），观察球体是否会永远弹跳
- **修改重力**：尝试 g = -1.62（月球重力），观察弹跳行为的差异
- **修改初始高度**：改变球体初始 z 坐标，观察落地速度的变化
- **添加 VTK 输出**：使用 VTKRecorder 引擎将仿真结果保存为 VTK 文件，在 ParaView
  中进行后处理

---

## 6. 练习题

### 练习 1：改变重力环境

修改重力加速度为月球表面的值 (g = -1.62 m/s²)，重新运行仿真。

**思考题**：
- 球体的弹跳次数是否增多？为什么？
- 球体最终静止的位置是否改变？
- 临界时间步长 PWaveTimeStep() 是否改变？为什么？

### 练习 2：多球碰撞

在脚本中添加第二个球体，初始位置为 (0.8, 0, 3)，半径 0.5，颜色为蓝色
[0, 0, 1]。

```python
O.bodies.append(sphere([0.8, 0, 3], 0.5, color=[0, 0, 1]))
```

**思考题**：
- 两个球体是否会碰撞？为什么？
- 需要修改 O.engines 中的任何设置吗？
- 球体最终的静止位置分别是多少？

### 练习 3：无阻尼对比

分别运行 damping=0.0 和 damping=0.2 两种情况，对比球体的运动行为。

**提示**：可以在脚本末尾添加位置监测代码来记录球体高度随时间的变化：

```python
# 监测球体高度
from yade import plot
O.engines += [PyRunner(command='myPlot()', iterPeriod=100)]
def myPlot():
    plot.addData(
        t=O.time,
        z=O.bodies[1].state.pos[2],
        vz=O.bodies[1].state.vel[2]
    )
O.run(100000, True)
plot.plot(noShow=True).savefig('bounce.png')
```

---

## 7. 延伸阅读

- [YADE 官方文档](https://yade-dem.org/doc/)
- [YADE Wiki](https://yade-dem.org/wiki/)
- Cundall, P.A. & Strack, O.D.L. (1979). A discrete numerical model for granular
  assemblies. Géotechnique, 29(1), 47-65.
- Radjai, F. & Dubois, F. (Eds.) (2011). Discrete-element Modeling of Granular
  Materials. Wiley-ISTE.

---

**下一课**：[02 重力沉降](../02_gravity_deposition/) —— 学习如何生成大量球体并模拟
颗粒沉降过程。

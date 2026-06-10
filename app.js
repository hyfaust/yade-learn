/* ============================================================
   YADE DEM Tutorial – Application Script
   Pure vanilla JS, no frameworks. All features self-contained.
   ============================================================ */

(function () {
  "use strict";

  /* --------------------------------------------------------
     1. EMBEDDED CHAPTER CONTENT (Markdown)
     Replace or extend the template literals with real content.
     -------------------------------------------------------- */
  const CHAPTERS = {
    1: {
      title: "弹跳球",
      level: "beginner",
      icon: "🟢",
      markdown: `# 01 弹跳球 —— YADE DEM 入门第一课

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
   - **求解运动方程**：根据牛顿第二定律 $F=ma$ 更新每个颗粒的加速度、速度和位置
   - **重复**：进入下一个时间步

这个循环在数学上可以表示为：

对每个时间步 $\\Delta t$：

1. 检测所有颗粒对之间的接触
2. 对每个接触，计算接触力（法向力 + 切向力）
3. 对每个颗粒，计算合力 $F = \\sum(\\text{接触力}) + \\text{重力}$
4. 对每个颗粒，更新加速度 $a = F/m$
5. 对每个颗粒，更新速度 $v = v + a \\cdot \\Delta t$
6. 对每个颗粒，更新位置 $x = x + v \\cdot \\Delta t$

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

\`\`\`
Body
├── Shape    —— 几何形状
├── Material —— 材料属性
├── State    —— 物理状态
└── Bound    —— 包围盒 (AABB)
\`\`\`

#### 3.1.1 Shape（几何形状）

Shape 定义了物体的几何特征。YADE 内置了多种 Shape 类型：

- **Sphere**：球体，由圆心和半径定义。是 DEM 中最常用的形状，因为球-球接触检测
  非常简单高效（只需比较圆心距与半径之和）。
- **Box**：长方体，由中心点和半尺寸 (extents) 定义。常用于构建容器壁和地面。
- **Facet**：三角面片，由三个顶点定义。常用于构建不规则边界。
- **Polyhedra**：多面体，支持任意凸多面体形状。
- **Clump**：簇，由多个球体粘结而成的刚性团簇，用于模拟不规则颗粒。

在本教程中，我们使用 Sphere 和 Box 两种 Shape：

\`\`\`python
# 创建球体：sphere(圆心坐标, 半径)
O.bodies.append(sphere([0, 0, 2], 1))

# 创建方块：box(中心坐标, 半尺寸, 是否固定)
O.bodies.append(box(center=[0, 0, 0], extents=[.5, .5, .5], fixed=True))
\`\`\`

#### 3.1.2 Material（材料属性）

Material 定义了物体的力学材料参数。YADE 中最常用的材料模型是 **FrictMat**
（摩擦材料），包含以下基本参数：

- **young** (杨氏模量, Pa)：材料的弹性刚度，默认 3.0×10⁷ Pa。值越大，材料越硬。
- **poisson** (泊松比)：横向应变与纵向应变的比值，默认 0.5（接近不可压缩）。
- **frictionAngle** (摩擦角, rad)：颗粒间摩擦角，默认 0.5236 rad ≈ 30°。

当两个物体发生接触时，YADE 会根据两个物体的材料参数，通过 \`Ip2_FrictMat_FrictMat_
FrictPhys\` 计算出接触的力学参数（等效刚度、摩擦系数等）。

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

\`O.engines\` 是 YADE 仿真的核心——它定义了每个时间步中依次执行的操作序列，称为
"引擎管线" (engine pipeline)。每个时间步，YADE 按顺序执行管线中的每个引擎。

本教程使用的标准管线包含四个引擎：

\`\`\`python
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
\`\`\`

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

$$
\\begin{aligned}
v(t + \\Delta t/2) &= v(t) + F(t)/m \\cdot \\Delta t/2 & \\text{\\# 半步速度更新} \\\\
x(t + \\Delta t)   &= x(t) + v(t + \\Delta t/2) \\cdot \\Delta t & \\text{\\# 位置更新} \\\\
&\\quad \\text{\\# 重新计算力 } F(t+\\Delta t) \\\\
v(t + \\Delta t)   &= v(t + \\Delta t/2) + F(t+\\Delta t)/m \\cdot \\Delta t/2 & \\text{\\# 又半步速度更新}
\\end{aligned}
$$

**关键参数**：
- **gravity**：全局重力加速度向量，如 (0, 0, -9.81) 表示 z 轴向下
- **damping**：局部非粘性阻尼系数 (0~1)。阻尼模拟了能量耗散，使系统能够趋近
  静态平衡。值越大，能量耗散越快，球体弹跳幅度衰减越快。

### 3.3 Functor 分发机制

YADE 使用 **Functor**（函子/函数对象）来实现"分发" (dispatch)——根据参与接触的
物体类型，自动选择合适的算法。Functor 的命名遵循严格的约定：

\`\`\`
类型前缀 + 涉及的类名 + 后缀
\`\`\`

四种 Functor 的命名规则如下：

#### Bo1_* —— Bound Functor（包围盒生成）

| 名称 | 含义 |
|------|------|
| \`Bo1_Sphere_Aabb\` | 为 Sphere 生成 AABB 包围盒 |
| \`Bo1_Box_Aabb\` | 为 Box 生成 AABB 包围盒 |

命名解读：**Bo**und → **1**个物体 → **Sphere**形状 → 输出 **Aabb**

#### Ig2_* —— Interaction Geometry Functor（接触几何）

| 名称 | 含义 |
|------|------|
| \`Ig2_Sphere_Sphere_ScGeom\` | 球-球接触，生成 ScGeom 几何信息 |
| \`Ig2_Box_Sphere_ScGeom\` | 盒-球接触，生成 ScGeom 几何信息 |

命名解读：**I**nteraction **G**eometry → **2**个物体 → **Sphere**+**Sphere** → 输出
**ScGeom** (Spherically-composite Contact Geometry)

#### Ip2_* —— Interaction Physics Functor（接触力学参数）

| 名称 | 含义 |
|------|------|
| \`Ip2_FrictMat_FrictMat_FrictPhys\` | 两个 FrictMat 的材料组合 → FrictPhys |

命名解读：**I**nteraction **P**hysics → **2**种材料 → **FrictMat**+**FrictMat** → 输出
**FrictPhys**

#### Law2_* —— Constitutive Law Functor（本构律）

| 名称 | 含义 |
|------|------|
| \`Law2_ScGeom_FrictPhys_CundallStrack\` | ScGeom + FrictPhys → Cundall-Strack 力学模型 |

命名解读：**Law** → **2**个输入(ScGeom + FrictPhys) → **CundallStrack** 本构模型

Cundall-Strack 模型是最基本的 DEM 接触模型：
- **法向力**：$F_n = k_n \\cdot \\delta_n$（弹簧模型，$\\delta_n$ 为重叠量）
- **切向力**：$F_t = \\min(k_t \\cdot \\delta_t, \\mu \\cdot F_n)$（弹簧-滑块模型，满足库伦摩擦定律）

### 3.4 时间步长

时间步长 Δt 的选取是 DEM 仿真的关键问题之一：

- **太大**：数值不稳定，仿真发散（颗粒"爆炸"飞出）
- **太小**：计算效率低，仿真推进缓慢

#### 临界时间步长

根据数值稳定性分析，时间步长必须小于系统的**临界时间步长**：

$$
\\Delta t_{cr} = 2 / \\omega_{max}
$$

其中 $\\omega_{max}$ 是系统中所有颗粒的最高固有角频率。对于一个弹簧-质量系统：

$$
\\omega = \\sqrt{k/m}
$$

其中 k 是接触刚度，m 是颗粒质量。因此：

$$
\\Delta t_{cr} = 2 \\cdot \\sqrt{m_{min} / k_{max}}
$$

即：最轻的颗粒和最硬的接触决定了最大可用时间步长。

#### PWaveTimeStep()

YADE 提供了 \`PWaveTimeStep()\` 函数自动估算安全时间步长。它计算的是**P 波**
（纵波/压缩波）穿过最小颗粒所需的时间：

$$
\\Delta t_{pwave} = d_{min} / \\sqrt{E / \\rho}
$$

其中 d_min 是最小颗粒直径，E 是杨氏模量，ρ 是密度。

在实际使用中，通常取一个安全系数（如 0.002 或 0.2）：

\`\`\`python
O.dt = 0.002 * PWaveTimeStep()  # 极其保守
O.dt = 0.2 * PWaveTimeStep()    # 较为高效但仍安全
O.dt = PWaveTimeStep()          # 理论极限，实际中可能不稳定
\`\`\`

**建议**：初学时使用较小的安全系数（如 0.002），确保仿真稳定。随着经验积累，
可以逐渐增大以提高效率。

---

## 4. 代码逐行解析

下面是对 \`bouncing_sphere.py\` 脚本的逐行详细解析：

### 4.1 引擎管线设置

\`\`\`python
O.engines = [
    ForceResetter(),
\`\`\`
每个时间步开始时，清除所有物体上累积的力和力矩。这是一个"重置"操作，确保每步
的力都是从零开始计算的。

\`\`\`python
    InsertionSortCollider([Bo1_Sphere_Aabb(), Bo1_Box_Aabb()]),
\`\`\`
创建碰撞检测器。参数列表中的两个 Functor 告诉系统：
- \`Bo1_Sphere_Aabb()\`：遇到 Sphere 类型的 Shape 时，用此方法生成 AABB
- \`Bo1_Box_Aabb()\`：遇到 Box 类型的 Shape 时，用此方法生成 AABB

如果场景中还有其他形状（如 Facet），也需要添加对应的 Bo1 Functor。

\`\`\`python
    InteractionLoop(
        [Ig2_Sphere_Sphere_ScGeom(), Ig2_Box_Sphere_ScGeom()],
        [Ip2_FrictMat_FrictMat_FrictPhys()],
        [Law2_ScGeom_FrictPhys_CundallStrack()]
    ),
\`\`\`
接触力计算循环，三个列表分别指定了：
- **Ig2 列表**：如何判断接触并计算几何量。球-球接触和盒-球接触使用不同的 Ig2
  Functor，但输出都是 ScGeom。
- **Ip2 列表**：如何从材料参数计算接触参数。两种 FrictMat 材料组合生成 FrictPhys
  接触属性。
- **Law2 列表**：如何从几何量和接触参数计算接触力。使用经典的 Cundall-Strack
  弹簧-滑块模型。

\`\`\`python
    NewtonIntegrator(damping=0.2, gravity=(0, 0, -9.81))
]
\`\`\`
牛顿积分器，负责运动方程求解：
- \`damping=0.2\`：施加 20% 的局部非粘性阻尼。这种阻尼形式对静止物体不施加阻力，
  只对运动中的物体产生与速度反向的阻尼力，模拟空气阻力和材料内部能量耗散。
- \`gravity=(0, 0, -9.81)\`：重力加速度，z 轴向下，大小 9.81 m/s²。

### 4.2 创建物体

\`\`\`python
O.bodies.append(box(center=[0, 0, 0], extents=[.5, .5, .5], fixed=True, color=[1, 0, 0]))
\`\`\`
创建地面方块：
- \`center=[0, 0, 0]\`：方块中心位于原点
- \`extents=[.5, .5, .5]\`：半尺寸为 0.5，所以方块实际尺寸为 1×1×1
- \`fixed=True\`：将方块固定，不受力和力矩影响（质量设为无穷大）
- \`color=[1, 0, 0]\`：红色显示（RGB 值，范围 0~1）

\`\`\`python
O.bodies.append(sphere([0, 0, 2], 1, color=[0, 1, 0]))
\`\`\`
创建下落球体：
- \`[0, 0, 2]\`：球心初始位置 (0, 0, 2)，在地面正上方
- \`1\`：半径为 1。由于地面方块的上表面在 z=0.5，球体下表面在 z=1，所以初始间距
  为 0.5。
- \`color=[0, 1, 0]\`：绿色显示

### 4.3 时间步长与运行

\`\`\`python
O.dt = .002 * PWaveTimeStep()
\`\`\`
设置时间步长。\`PWaveTimeStep()\` 根据当前场景中最小颗粒和材料参数计算出 P 波
特征时间。乘以 0.002 是一个非常保守的安全系数，保证数值稳定。

\`\`\`python
O.run(100000, True)
\`\`\`
执行仿真：
- \`100000\`：运行 100,000 个时间步
- \`True\`：阻塞模式，等仿真完成后才继续执行后续 Python 代码

如果 dt = 0.002 * PWaveTimeStep()，总仿真时间约为几百个特征时间，足以让球体
完成多次弹跳并静止。

### 4.4 输出结果

\`\`\`python
print("仿真结束！球体最终位置：")
print(O.bodies[1].state.pos)
\`\`\`
仿真结束后，打印球体（body 索引为 1）的最终位置。理论上，球体应停留在 z ≈ 1.5
附近（地面半高 0.5 + 球半径 1）。

---

## 5. 运行与观察

### 5.1 运行方法

在终端中执行：

\`\`\`bash
cd 01_bouncing_sphere
yadedaily bouncing_sphere.py
\`\`\`

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
- 按 \`d\` 键可以显示接触力链
- 按 \`s\` 键可以显示速度矢量

如果在无图形界面的服务器上运行，可以添加 \`--nogui\` 参数：

\`\`\`bash
yadedaily --nogui bouncing_sphere.py
\`\`\`

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

\`\`\`python
O.bodies.append(sphere([0.8, 0, 3], 0.5, color=[0, 0, 1]))
\`\`\`

**思考题**：
- 两个球体是否会碰撞？为什么？
- 需要修改 O.engines 中的任何设置吗？
- 球体最终的静止位置分别是多少？

### 练习 3：无阻尼对比

分别运行 damping=0.0 和 damping=0.2 两种情况，对比球体的运动行为。

**提示**：可以在脚本末尾添加位置监测代码来记录球体高度随时间的变化：

\`\`\`python
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
\`\`\`

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
颗粒沉降过程。`
    },
    2: {
      title: "重力沉降",
      level: "beginner",
      icon: "🟢",
      markdown: `# 02 重力沉降 —— 多颗粒仿真入门

## 1. 项目简介

本项目是 YADE DEM 学习系列的第二个教程。在上一个教程中，我们学习了单个球体的
弹跳运动。本教程将把这个场景扩展到**大量球体**的仿真，模拟**重力沉降**
(gravity deposition) 过程：

- 创建一个**无盖容器**（由 5 面墙壁构成的方形箱子）
- 使用 \`SpherePack\` 工具**随机生成 200+ 个球体**，分布在容器上方
- 在重力作用下，所有球体自由下落并相互碰撞
- 球体逐渐堆积在容器底部，最终达到准静态平衡
- 使用 \`PyRunner\` 和 \`plot\` 模块**实时记录数据**并绘制沉降曲线

通过本教程，你将掌握：
- \`SpherePack\` 类及其 \`makeCloud()\` 方法：批量生成随机球体堆积
- \`toSimulation()\` 方法：将 SpherePack 转移到仿真场景中
- \`yade.plot\` 模块：仿真数据记录与绘图
- \`PyRunner\`：周期性 Python 回调函数
- 多体碰撞的包围盒 (AABB) 检测机制
- 颗粒沉降与力链 (force chain) 的物理概念

---

## 2. 核心概念详解

### 2.1 SpherePack —— 球体堆积工具

\`SpherePack\` 是 YADE 提供的一个**实用工具类**，用于生成和操作球体的随机堆积。
它的关键特点是：

- **独立于仿真**：SpherePack 可以在不启动仿真的情况下生成球体集合。它只是一个
  数据结构，存储了球体的位置和半径信息。
- **可复用**：同一个 SpherePack 可以多次导入不同的仿真场景中。
- **支持多种生成方式**：随机生成、规则排列、从文件导入等。

\`\`\`python
from yade import pack

# 创建 SpherePack 实例
sp = pack.SpherePack()
\`\`\`

### 2.2 makeCloud() —— 随机生成球体

\`makeCloud()\` 是 SpherePack 最常用的方法，用于在指定区域内随机生成球体：

\`\`\`python
sp.makeCloud(
    cornerMin=(0, 0, 0),      # 区域最小角点 (x_min, y_min, z_min)
    cornerMax=(5, 5, 10),      # 区域最大角点 (x_max, y_max, z_max)
    rMean=0.3,                 # 球体平均半径
    rRelFuzz=0.5,              # 半径相对浮动系数 (0~1)
    num=200,                   # 生成球体数量
    periodic=False             # 是否使用周期性边界
)
\`\`\`

**参数详解**：

| 参数 | 类型 | 说明 |
|------|------|------|
| \`cornerMin\` | tuple(x,y,z) | 生成区域的最小角坐标 |
| \`cornerMax\` | tuple(x,y,z) | 生成区域的最大角坐标 |
| \`rMean\` | float | 球体的平均半径 |
| \`rRelFuzz\` | float | 半径的相对浮动范围。实际半径 r = rMean * (1 ± rRelFuzz * random) |
| \`num\` | int | 生成的球体数量 |
| \`periodic\` | bool | 是否使用周期性边界（True 时球体可跨越边界） |

**关于 rRelFuzz**：
- \`rRelFuzz = 0\`：所有球体半径相同（单分散系统）
- \`rRelFuzz = 0.5\`：半径在 rMean 的 50% 范围内波动（多分散系统）
- \`rRelFuzz = 1\`：半径最大可能为 2 倍 rMean（注意：不能为负，所以实际范围不对称）

**注意**：\`makeCloud()\` 生成的球体之间可能有重叠。这些重叠会在仿真开始后被
接触力自动推开。如果初始重叠过大，可能需要降低时间步长或增大阻尼来避免发散。

### 2.3 toSimulation() —— 转移到仿真场景

\`SpherePack\` 生成的球体只是数据，需要通过 \`toSimulation()\` 方法将它们添加到
当前仿真中：

\`\`\`python
sp.toSimulation()
\`\`\`

执行后，SpherePack 中的所有球体会被依次添加到 \`O.bodies\` 中，成为可以参与
仿真计算的 Body 对象。每个球体都会自动获得默认的 Material 属性。

**返回值**：\`toSimulation()\` 返回一个列表，包含所有新添加的 Body 的 ID。

\`\`\`python
ids = sp.toSimulation()
print(f"添加了 {len(ids)} 个球体")
print(f"ID 范围：{ids[0]} ~ {ids[-1]}")
\`\`\`

### 2.4 数据记录与绘图 —— yade.plot 模块

YADE 内置了 \`plot\` 模块，用于在仿真过程中记录数据和绘制图表。这是分析仿真
结果的重要工具。

#### 2.4.1 plot.addData() —— 添加数据点

在仿真运行过程中，通过调用 \`plot.addData()\` 记录当前时刻的物理量：

\`\`\`python
plot.addData(
    t=O.time,                    # 当前仿真时间
    numContacts=len(O.interactions),  # 接触数量
    kineticEnergy=kineticEnergy()     # 系统总动能
)
\`\`\`

每次调用会在内部数据表中添加一行。参数名会成为列名（如 't'、'numContacts'）。

#### 2.4.2 plot.plots —— 定义绘图配置

通过 \`plot.plots\` 字典定义要绘制的图表：

\`\`\`python
plot.plots = {
    't': ('numContacts',),           # x 轴为 t，y 轴为 numContacts
    't ': ('kineticEnergy',)         # 注意：'t ' 带空格表示新图
}
\`\`\`

**关键语法**：
- 键是 x 轴变量名
- 值是 y 轴变量名的元组
- 同一个键下可以放多个 y 变量，会画在同一张图上
- **空格技巧**：键名加空格（如 \`'t '\`）表示创建一张新的图，而不是覆盖原有图

#### 2.4.3 plot.plot() —— 绘制并保存图表

\`\`\`python
plot.plot()              # 在屏幕上显示图表
plot.plot(noShow=True)   # 不显示窗口，直接返回 Figure 对象
# 保存为文件：
fig = plot.plot(noShow=True)
fig.savefig('output.png')
\`\`\`

### 2.5 PyRunner —— 周期性 Python 回调

\`PyRunner\` 是 YADE 中一个非常有用的引擎，它允许在仿真过程中定期执行 Python
代码：

\`\`\`python
PyRunner(
    command='myFunction()',   # 要执行的 Python 代码（字符串）
    iterPeriod=1000           # 每隔多少个时间步执行一次
)
\`\`\`

也可以使用 \`realPeriod\` 按仿真时间间隔触发（单位：秒）：

\`\`\`python
PyRunner(
    command='myFunction()',
    realPeriod=0.1           # 每 0.1 秒仿真时间执行一次
)
\`\`\`

**典型用途**：
- 定期记录数据到 \`plot\`
- 监控仿真状态（动能是否趋近于零）
- 动态调整仿真参数
- 输出中间结果

**注意**：\`command\` 中的函数名必须是全局作用域中已定义的。建议在脚本顶部先定义
函数，再在 \`PyRunner\` 中引用它。

### 2.6 多体碰撞检测

当场景中有 N 个物体时，理论上有 $N(N-1)/2$ 种可能的接触对。对于 N=200 的场景，
这意味着约 20,000 个接触对需要检测。但实际在同一时刻，只有少数物体真正接触。

YADE 使用**两阶段碰撞检测策略**来高效处理这个问题：

#### 粗筛阶段 (Broad Phase)

\`InsertionSortCollider\` 使用 AABB 重叠检测来快速排除不可能接触的物体对：
1. 将每个物体的 AABB 投影到 x、y、z 轴上
2. 使用插入排序算法找出所有区间重叠的物体对
3. 只有 AABB 重叠的物体对才进入下一阶段

#### 精检阶段 (Narrow Phase)

\`Ig2_*\` Functor 对粗筛阶段产生的候选对进行精确几何检测：
- 计算两个球体圆心之间的距离
- 与半径之和比较，判断是否真正重叠
- 如果重叠，计算重叠量、接触点位置、法向量等

**性能考虑**：
- InsertionSortCollider 的时间复杂度接近 O(n)（物体移动量小时）
- 精检阶段只处理少量候选对
- 这种策略使得百万级颗粒的仿真成为可能

### 2.7 包围盒 (AABB)

**AABB** (Axis-Aligned Bounding Box，轴对齐包围盒) 是碰撞检测中的核心概念：

\`\`\`
    +------------------+
    |                  |    ← AABB（较大的包围盒）
    |    +-------+     |
    |    | Sphere|     |    ← 实际球体
    |    +-------+     |
    |                  |
    +------------------+
\`\`\`

- AABB 是一个长方体，其边与坐标轴平行
- 它完全包围物体的 Shape（对于球体，AABB 就是边长等于直径的正方体）
- AABB 比精确几何体更大，但**重叠检测极其简单**：只需比较 3 对坐标值
- \`Bo1_Sphere_Aabb()\` 负责为球体生成 AABB
- 当球体移动时，AABB 会随之更新（由 \`BoundDispatcher\` 或 \`InsertionSortCollider\`
  自动完成）

**为什么 AABB 对球体是正方体？**

球体的 AABB 边长等于 2r（直径），且三个方向的尺寸相同。这是因为 AABB 必须
与坐标轴对齐，无论球体如何旋转，其包围盒始终是同一个正方体。

---

## 3. 代码逐行解析

下面对 \`gravity_deposition.py\` 脚本进行逐行解析。

### 3.1 导入模块

\`\`\`python
from yade import pack, plot
\`\`\`
- \`pack\`：提供 SpherePack 类，用于批量生成球体
- \`plot\`：提供数据记录和绘图功能

### 3.2 定义数据记录函数

\`\`\`python
def recordData():
    plot.addData(
        t=O.time,
        i=O.iter,
        numContacts=len(O.interactions),
        kineticEnergy=kineticEnergy()
    )
\`\`\`
这个函数在 PyRunner 的每次触发时被调用：
- \`O.time\`：当前仿真时间（秒）
- \`O.iter\`：当前迭代步数
- \`len(O.interactions)\`：当前活跃接触数，反映颗粒间的接触情况
- \`kineticEnergy()\`：系统总动能，反映运动的剧烈程度

### 3.3 材料设置

\`\`\`python
O.materials.append(FrictMat(
    young=1e7,
    poisson=0.3,
    frictionAngle=radians(30),
    density=2600,
    label='defaultMat'
))
\`\`\`
定义默认材料参数：
- \`young=1e7\`：杨氏模量 10 MPa（适中的刚度）
- \`poisson=0.3\`：泊松比 0.3
- \`frictionAngle=radians(30)\`：摩擦角 30°（转换为弧度）
- \`density=2600\`：密度 2600 kg/m³（接近砂石密度）
- \`label='defaultMat'\`：材料标签，方便后续引用

### 3.4 创建容器

使用 \`box()\` 函数创建 5 面墙壁，构成一个顶部开口的容器：

\`\`\`python
# 底面
O.bodies.append(box(center=[2.5, 2.5, -0.05], extents=[2.55, 2.55, 0.05],
                     fixed=True, color=[0.6, 0.6, 0.6]))
\`\`\`
底面：中心在 (2.5, 2.5, -0.05)，尺寸 5.1×5.1×0.1

\`\`\`python
# 四面墙壁
O.bodies.append(box(center=[-0.05, 2.5, 2.5], extents=[0.05, 2.55, 2.55],
                     fixed=True, color=[0.8, 0.4, 0.4]))  # 左墙
O.bodies.append(box(center=[5.05, 2.5, 2.5], extents=[0.05, 2.55, 2.55],
                     fixed=True, color=[0.8, 0.4, 0.4]))  # 右墙
O.bodies.append(box(center=[2.5, -0.05, 2.5], extents=[2.55, 0.05, 2.55],
                     fixed=True, color=[0.4, 0.8, 0.4]))  # 前墙
O.bodies.append(box(center=[2.5, 5.05, 2.5], extents=[2.55, 0.05, 2.55],
                     fixed=True, color=[0.4, 0.8, 0.4]))  # 后墙
\`\`\`

**注意**：墙壁的尺寸故意比容器内部空间稍大，以确保无间隙。

### 3.5 生成球体

\`\`\`python
sp = pack.SpherePack()
sp.makeCloud((0, 0, 0.5), (5, 5, 9), rMean=0.3, rRelFuzz=0.5, num=200)
sp.toSimulation()
\`\`\`
1. 创建 SpherePack 实例
2. 在 5×5×8.5 的区域内随机生成 200 个球体，平均半径 0.3，半径浮动 50%
3. 球体的 z 坐标从 0.5 开始（高于容器底部），确保球体在容器内部
4. 将球体转移到仿真场景中

### 3.6 引擎管线

\`\`\`python
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
\`\`\`

与教程 01 的管线相同，但有以下变化：
- \`damping=0.4\`：增大阻尼（40%），帮助多体系统更快趋于平衡
- 新增 \`PyRunner\`：每 500 步调用一次 \`recordData()\` 记录数据

### 3.7 配置绘图

\`\`\`python
plot.plots = {
    't': ('numContacts',),
    't ': ('kineticEnergy',)
}
\`\`\`
定义两张图表：
- 图 1：横轴为时间 t，纵轴为接触数 numContacts
- 图 2：横轴为时间 t，纵轴为动能 kineticEnergy

### 3.8 运行仿真

\`\`\`python
O.dt = 0.5 * PWaveTimeStep()
O.run(200000, True)
\`\`\`
- 时间步长取 PWaveTimeStep 的 50%（比教程 01 的 0.2% 大得多，因为不需要精确
  弹跳细节，只需平稳沉降）
- 运行 200,000 个时间步

### 3.9 保存结果

\`\`\`python
fig = plot.plot(noShow=True)
fig.savefig('gravity_deposition.png', dpi=150)
\`\`\`
将绘图结果保存为 PNG 图片。

---

## 4. 运行与观察

### 4.1 运行方法

\`\`\`bash
cd 02_gravity_deposition
yadedaily gravity_deposition.py
\`\`\`

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
- 在 YADE 中按 \`d\` 键可以可视化力链（力越大，线越粗）

### 4.4 可视化技巧

在 GUI 窗口中：
- 按 \`d\`：显示接触力力链
- 按 \`s\`：显示速度矢量
- 按 \`b\`：显示包围盒
- 按 \`w\`：线框模式切换
- 按 \`Ctrl+S\`：截图

---

## 5. 练习题

### 练习 1：改变颗粒数量

将 \`num=200\` 分别改为 50、500、1000，观察并对比：
- 沉降完成所需的时间
- 最终的接触数量
- 动能曲线的形态

**思考题**：接触数与颗粒数之间大致是什么比例关系？为什么？

### 练习 2：改变摩擦角

将 \`frictionAngle=radians(30)\` 分别改为 \`radians(0)\`（光滑颗粒）和
\`radians(45)\`（粗糙颗粒），观察：

\`\`\`python
O.materials.append(FrictMat(
    young=1e7,
    poisson=0.3,
    frictionAngle=radians(0),  # 无摩擦！
    density=2600
))
\`\`\`

**思考题**：
- 摩擦角为 0 时，颗粒堆积的最终形态是什么样的？（提示：想象沙子 vs 水）
- 摩擦角增大时，堆积角度如何变化？

### 练习 3：添加 VTK 输出

在引擎管线中添加 VTKRecorder，将仿真结果保存为 VTK 文件，然后在 ParaView
中进行三维可视化：

\`\`\`python
O.engines += [
    VTKRecorder(
        iterPeriod=5000,
        fileName='vtk/gravity-',
        recorders=['spheres', 'intr', 'colors']
    )
]
\`\`\`

**注意**：运行前需要创建 \`vtk/\` 目录（\`mkdir vtk\`）。

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

**下一课**：[03 固结试验](../03_oedometric_test/) —— 学习边界加载和应力-应变分析`
    },
    3: {
      title: "一维压缩试验",
      level: "intermediate",
      icon: "🟡",
      markdown: `# 项目三：一维压缩试验（Oedometric Test）

## 1. 项目简介

一维压缩试验（Oedometric Test，又称 K0 压缩试验）是岩土工程中最基本的
力学试验之一。在此试验中，圆柱形土样被放置在刚性环（oedometer cell）中，
仅允许竖向变形，侧向变形被完全约束。这意味着侧向应变为零（ε_x = ε_y = 0），
仅竖向应变 ε_z 不为零。

本项目使用 YADE 离散元软件模拟一维压缩试验，帮助读者理解：

- 颗粒材料在侧限条件下的力学响应
- 应力-应变关系曲线的获取方法
- 力链（force chain）的形成与分布
- K0 条件（静止土压力系数）的物理含义
- 数据采集与可视化技术

### 运行方式

\`\`\`bash
cd /home/faust/vibe/yade_learn/03_oedometric_test
yadedaily oedometric_test.py
\`\`\`

---

## 2. 核心概念详解

### 2.1 应力与应变

#### 应力张量

在连续介质力学中，应力状态用二阶应力张量 σ_ij 表示：

$$
\\boldsymbol{\\sigma} =
\\begin{pmatrix}
\\sigma_{xx} & \\tau_{xy} & \\tau_{xz} \\\\
\\tau_{yx} & \\sigma_{yy} & \\tau_{yz} \\\\
\\tau_{zx} & \\tau_{zy} & \\sigma_{zz}
\\end{pmatrix}
\\qquad (\\text{对称张量：}\\tau_{xy}=\\tau_{yx},\\ \\tau_{xz}=\\tau_{zx},\\ \\tau_{yz}=\\tau_{zy})
$$

在离散元方法中，宏观应力张量通过颗粒接触力的贡献来计算：

$$
\\sigma_{ij} = \\frac{1}{V} \\sum f_i \\cdot l_j
$$

其中 V 是代表性体积单元的体积，$f_i$ 是接触力分量，$l_j$ 是接触支量臂
（两个接触颗粒中心之间的矢量分量）。

#### 应变

- **轴向应变**：$\\varepsilon_a = \\Delta L / L_0$，其中 $L_0$ 为初始高度
- **体积应变**：$\\varepsilon_v = \\Delta V / V_0$
- **偏应变**（剪切应变分量）：$\\varepsilon_q = \\varepsilon_a - \\varepsilon_v/3$（在一维条件下）

在一维压缩条件下，由于侧向应变为零：
- $\\varepsilon_x = \\varepsilon_y = 0$
- $\\varepsilon_v = \\varepsilon_z$（体积应变等于轴向应变）

### 2.2 一维压缩条件（K0 条件）

**K0**（静止土压力系数）定义为侧向应力与竖向应力之比：

$$
K_0 = \\sigma_h / \\sigma_v
$$

在一维压缩条件下，$K_0$ 的理论值取决于材料的泊松比：

$$
K_0 = \\nu / (1 - \\nu)
$$

对于弹性材料，典型 K0 值：
- ν = 0.2 时，K0 ≈ 0.25
- ν = 0.3 时，K0 ≈ 0.43
- ν = 0.5 时，K0 = 1.0（不可压缩材料）

但在颗粒材料中，K0 值还受颗粒摩擦角、级配、孔隙率等因素影响。
Jaky 公式给出了砂土的经验关系：

$$
K_0 \\approx 1 - \\sin(\\varphi)
$$

其中 φ 为内摩擦角。例如 φ = 30° 时，K0 ≈ 0.5。

### 2.3 UniaxialStrainer

YADE 提供了 \`UniaxialStrainer\` 引擎来施加受控的单轴应变。其工作原理：

1. 选择试样两端的边界颗粒（或墙）
2. 根据指定的应变速率移动边界
3. 记录作用在边界的力

关键参数：
- **strainRate**：应变速率（1/s），正值为压缩
- **axis**：压缩方向（0=x, 1=y, 2=z）
- **asymmetry**：0 = 两端对称移动，-1/+1 = 仅一端移动
- **stressStrain**：记录应力-应变数据的标志
- **blockDisplacements** / **blockRotations**：约束边界颗粒的运动

在本项目中，我们不直接使用 UniaxialStrainer 引擎，而是通过手动控制
边界墙的速度来实现竖向压缩，这样可以更灵活地控制试验过程。

### 2.4 力链（Force Chain）

力链是颗粒材料中接触力形成的链状网络结构。在受压的颗粒集合体中：

- 力并非均匀分布，而是集中在少数颗粒链上
- 强力链（strong force chain）承载大部分荷载，沿主应力方向分布
- 弱力链（weak force chain）环绕在强力链之间
- 力链的形态直接影响材料的宏观力学行为

力链的可视化对于理解以下现象至关重要：
- 应力传递机制
- 剪切带的形成
- 各向异性的发展
- 颗粒材料的局部化变形

在 YADE 中，可以通过 \`VTKRecorder\` 导出接触力信息，并使用 ParaView
进行力链可视化。

### 2.5 数据采集：应力-应变曲线

应力-应变曲线是表征材料力学行为最基本的工具。在 DEM 模拟中：

#### 计算轴向应力

轴向应力 σ_a 通过测量作用在顶部或底部边界上的总力除以截面积获得：

$$
\\sigma_z = F_z / A
$$

其中：
- F_z 是作用在边界的竖向力
- A 是试样的横截面积

#### 计算轴向应变

$$
\\varepsilon_a = (L_0 - L) / L_0 = 1 - L/L_0
$$

其中 L0 为初始高度，L 为当前高度。

#### YADE 中的应力测量方法

YADE 提供了几种测量力的方法：

1. **直接累加边界力**：遍历边界颗粒或墙的接触力
2. **\`approxSectionArea()\`**：估算指定截面的面积
3. **\`forcesOnCoordPlane()\`**：计算穿过坐标平面的合力

### 2.6 approxSectionArea() 与 forcesOnCoordPlane()

#### approxSectionArea()

\`utils.approxSectionArea()\` 函数估算试样在某一高度处的截面积：

\`\`\`python
area = utils.approxSectionArea(center=O.cell.hSize if O.periodic else None,
                                z=height)
\`\`\`

该函数通过统计穿过指定截面的颗粒投影面积来估算截面积。

#### forcesOnCoordPlane()

\`utils.forcesOnCoordPlane()\` 函数计算作用在指定坐标平面上的合力：

\`\`\`python
# 计算穿过 z = zCoord 平面的竖向力
F = utils.forcesOnCoordPlane(zCoord)
# F 是一个三维矢量，F[2] 即为竖向分量
\`\`\`

---

## 3. 代码逐行解析

### 3.1 导入与基本设置

\`\`\`python
from yade import pack, plot, utils, qt
import numpy as np
\`\`\`

- \`pack\`：球体堆积生成工具
- \`plot\`：数据采集与绘图模块
- \`utils\`：工具函数（力的测量等）
- \`qt\`：三维可视化

### 3.2 材料与模拟参数

\`\`\`python
# 颗粒材料参数
young = 5e6        # 杨氏模量 [Pa]
poisson = 0.3       # 泊松比
frictionAngle = 0.5  # 颗粒间摩擦角 [rad]（约 28.6°）
density = 2600       # 颗粒密度 [kg/m³]
\`\`\`

注意摩擦角以弧度为单位。在 YADE 中，\`frictionAngle\` 接受弧度值。

### 3.3 生成球体堆积

使用 \`pack.randomDensePack()\` 在长方体区域内生成随机密实堆积：

\`\`\`python
pred = pack.inAlignedBox((0, 0, 0), (width, depth, height))
sp = pack.SpherePack()
sp = sp.makeCloud((0, 0, 0), (width, depth, height),
                   rMean=radius, rRelFuzz=0.3,
                   num=spheresNum, periodic=False)
\`\`\`

参数说明：
- 前两个参数定义了生成区域的对角点
- \`rMean\`：平均半径
- \`rRelFuzz\`：半径相对分散度（0 为等径，越大越分散）
- \`num\`：颗粒数量
- \`periodic\`：是否使用周期性边界

### 3.4 边界设置

在一维压缩试验中，需要设置：
- **顶部和底部墙**：施加竖向压缩
- **侧向约束**：通过固定侧向边界颗粒的 x、y 方向位移来实现

\`\`\`python
# 创建顶部和底部刚性墙
wallTop = utils.wall(position=height, axis=2, sense=-1)
wallBot = utils.wall(position=0, axis=2, sense=1)
O.bodies.append([wallTop, wallBot])
\`\`\`

### 3.5 引擎设置

\`\`\`python
O.engines = [
    ForceResetter(),                    # 重置力
    InsertionSortCollider([Bo1_Sphere_Aabb(), Bo1_Wall_Aabb()]),  # 碰撞检测
    InteractionLoop(
        [Ig2_Sphere_Sphere_ScGeom(), Ig2_Wall_Sphere_ScGeom()],  # 几何
        [Ip2_FrictMat_FrictMat_FrictPhys()],                      # 物理
        [Law2_ScGeom_FrictPhys_CundallStrack()]                   # 本构
    ),
    NewtonIntegrator(damping=0.4),      # 牛顿积分
    PyRunner(iterPeriod=100, command='collectData()'),  # 数据采集
]
\`\`\`

阻尼参数 \`damping=0.4\` 用于耗散系统动能，模拟准静态加载条件。

### 3.6 压缩加载

通过控制顶部墙的速度来施加竖向压缩：

\`\`\`python
loadingRate = -0.1  # 加载速率 [m/s]，负值表示向下压缩
O.bodies[wallTopId].state.vel = Vector3(0, 0, loadingRate)
\`\`\`

### 3.7 数据采集函数

\`\`\`python
def collectData():
    # 获取当前试样高度
    z_top = O.bodies[wallTopId].state.pos[2]
    z_bot = O.bodies[wallBotId].state.pos[2]
    currentHeight = z_top - z_bot

    # 计算轴向应变
    axialStrain = 1 - currentHeight / initialHeight

    # 计算轴向应力（通过边界力）
    F_top = O.forces.f(wallTopId)[2]
    stress = abs(F_top) / crossSectionArea

    # 记录数据
    plot.addData(
        strain=axialStrain,
        stress=stress,
        iter=O.iter,
        height=currentHeight
    )
\`\`\`

---

## 4. 物理背景与工程意义

### 4.1 一维压缩与土的本构关系

一维压缩试验是研究土体压缩性的经典方法。在实际工程中：

- **地基沉降计算**：建筑物荷载下土层的竖向变形
- **土体固结**：饱和黏土在荷载作用下的时间相关变形
- **K0 条件**：挡土墙、隧道衬砌等结构设计中的侧向土压力

### 4.2 DEM 模拟的优势

使用离散元方法模拟一维压缩试验的优势：

1. **细观力学信息**：可以直接观察力链、配位数、孔隙率等细观量
2. **参数敏感性分析**：可以系统地改变颗粒性质（摩擦角、刚度等）
3. **可视化**：直观展示颗粒运动和力的传递
4. **无本构假设**：材料的宏观行为从颗粒间的接触力学自然涌现

### 4.3 K0 值的测定

在 DEM 模拟中，K0 值的测定方法：

1. 在侧向边界颗粒上测量法向接触力
2. 计算侧向应力 σ_h 和竖向应力 σ_v
3. $K_0 = \\sigma_h / \\sigma_v$

对于无黏性颗粒材料，K0 值通常随压缩过程而变化，最终趋向一个稳态值。

---

## 5. 练习题

### 练习 1：摩擦角对 K0 的影响

修改颗粒间摩擦角（如 0.2、0.5、1.0 弧度），运行模拟并比较：
- 不同摩擦角下的 K0 值
- 应力-应变曲线的斜率
- 验证 Jaky 公式 K0 ≈ 1 - sin(φ) 的适用性

### 练习 2：加卸载循环

在一维压缩试验中加入卸载阶段：
1. 加载至某应力水平后，反转顶部墙的速度方向
2. 记录卸载路径的应力-应变曲线
3. 观察滞回效应和塑性应变

### 练习 3：力链可视化

使用 VTKRecorder 导出力链数据：
\`\`\`python
VTKRecorder(iterPeriod=1000, recorders=['spheres', 'intr'],
            fileName='/tmp/oedo_force_chain_')
\`\`\`
在 ParaView 中加载并可视化力链，观察其随加载过程的演变。

### 练习 4：颗粒级配的影响

使用 \`psd()\` 方法设置不同的颗粒级配（等径 vs 多分散），比较：
- 压缩性差异
- K0 值的变化
- 孔隙率的演化

### 练习 5：阻尼参数的影响

尝试不同的 NewtonIntegrator 阻尼值（0.1 ~ 0.8），观察：
- 达到准静态平衡所需的时间
- 应力-应变曲线的平滑程度
- 最终结果是否对阻尼值敏感

---

## 6. 参考文献

1. Cundall, P.A. & Strack, O.D.L. (1979). A discrete numerical model for granular assemblies. *Géotechnique*, 29(1), 47-65.
2. Šmilauer, V. et al. (2022). *Yade Documentation* (3rd ed.). https://yade-dem.org/doc/
3. Oda, M. (1977). The mechanism of fabric changes during compressional deformation of sand. *Soils and Foundations*, 17(2), 15-27.
4. Radjai, F. et al. (1996). Force distributions in dense two-dimensional granular systems. *Physical Review Letters*, 77(2), 274.
5. Jaky, J. (1944). The coefficient of earth pressure at rest. *Journal of the Society of Hungarian Architects and Engineers*, 78(22), 355-358.

---

## 7. 进阶阅读

- 了解三轴试验（Triaxial Test）与一维压缩的区别，参见项目 \`06_triaxial_test\`
- 周期性边界条件下的压缩试验，参见项目 \`04_periodic_shear\`
- 更多球体堆积技术，参见项目 \`05_sphere_packing\``
    },
    4: {
      title: "周期性简单剪切",
      level: "intermediate",
      icon: "🟡",
      markdown: `# 项目四：周期性简单剪切试验（Periodic Simple Shear Test）

## 1. 项目简介

简单剪切试验是研究颗粒材料剪切行为的基本力学试验。与传统的边界墙剪切
试验不同，本项目使用**周期性边界条件**（Periodic Boundary Conditions）来
模拟无限大均匀介质中的简单剪切，从而消除边界效应的影响。

周期性边界条件的核心思想是：模拟盒子（cell）在各个方向上无限重复，当
颗粒从盒子一侧移出时，会自动从对面进入。这使得一个有限的模拟盒子可以
代表无限大的均匀介质。

本项目使用 YADE 离散元软件模拟周期性边界条件下的简单剪切试验，帮助
读者理解：

- 周期性边界条件的原理与实现
- 变形梯度张量（hSize）的含义与操控
- 简单剪切与纯剪切的区别
- 剪切过程中的体积变化（剪胀/剪缩）
- 临界状态的概念
- 周期性模拟中的应力测量方法

### 运行方式

\`\`\`bash
cd /home/faust/vibe/yade_learn/04_periodic_shear
yadedaily periodic_shear.py
\`\`\`

---

## 2. 核心概念详解

### 2.1 周期性边界条件（Periodic BC）

#### 为什么需要周期性边界条件？

在传统的 DEM 模拟中，使用刚性墙作为边界。这种方法存在以下问题：

1. **边界效应**：靠近边界处的颗粒受边界约束影响，其力学行为与内部
   颗粒不同。这导致模拟结果依赖于试样尺寸与颗粒尺寸的比值。

2. **计算效率**：为了减小边界效应，需要使用足够大的试样，这增加了
   计算成本。

3. **不均匀变形**：在剪切过程中，变形往往集中在剪切带附近，而非
   均匀分布在整个试样中。

周期性边界条件通过假设模拟盒子在各个方向上无限重复来解决这些问题：

\`\`\`
     ┌─────────┐         ┌─────────┐
     │  ●  ●   │         │  ●  ●   │
     │    ●    │ ──→     │    ●    │
     │  ●      │         │  ●      │
     └─────────┘         └─────────┘
       主盒子               重复副本
\`\`\`

当一个颗粒从盒子右侧移出时，它会自动从左侧进入，保持完全相同的
运动状态。这确保了：
- 没有边界颗粒
- 变形在整个盒子内均匀分布
- 试样代表无限大均匀介质

#### 周期性边界条件的数学描述

模拟盒子由一个变形梯度张量 F 描述：

$$
\\mathbf{F} = \\text{hSize} = \\begin{bmatrix} h_{11} & h_{12} & h_{13} \\\\ h_{21} & h_{22} & h_{23} \\\\ h_{31} & h_{32} & h_{33} \\end{bmatrix}
$$

其中每一行对应盒子的一个边向量。颗粒的实际位置通过以下方式确定：

$$
\\mathbf{x}_{\\text{real}} = \\mathbf{F} \\times \\mathbf{x}_{\\text{unit}}
$$

其中 $\\mathbf{x}_{\\text{unit}}$ 是颗粒在单位立方体 $[0,1]^3$ 中的坐标。

盒子的体积为：

$$
V = |\\det(\\mathbf{F})| = \\det(\\text{hSize})
$$

#### YADE 中的实现

在 YADE 中，周期性边界通过以下方式启用：

\`\`\`python
O.periodic = True
O.cell.refSize = Vector3(Lx, Ly, Lz)  # 参考（初始）尺寸
\`\`\`

\`O.cell.hSize\` 是 3×3 矩阵，描述当前盒子的形状和尺寸。
\`O.cell.trsf\` 是累积变形梯度。

### 2.2 O.cell 对象

\`O.cell\` 是 YADE 中管理周期性盒子的核心对象，其主要属性：

#### refSize

参考尺寸，即初始时盒子的边长（对角矩阵）：

\`\`\`python
O.cell.refSize = Vector3(0.01, 0.01, 0.01)  # 1cm 的立方体
\`\`\`

#### hSize

当前变形梯度张量，是一个 3×3 矩阵（Matrix3 类型）。初始时等于
refSize 的对角矩阵：

$$
\\text{hSize} = \\begin{bmatrix} L_x & 0 & 0 \\\\ 0 & L_y & 0 \\\\ 0 & 0 & L_z \\end{bmatrix}
$$

当施加剪切变形时，hSize 变为：

$$
\\text{hSize} = \\begin{bmatrix} L_x & \\gamma L_y & 0 \\\\ 0 & L_y & 0 \\\\ 0 & 0 & L_z \\end{bmatrix} \\quad \\text{(xy 平面简单剪切)}
$$

其中 $\\gamma$ 是剪切应变。

#### trsf

累积变形梯度，用于跟踪从初始状态到当前状态的总变形。

#### 盒子体积

\`\`\`python
volume = O.cell.hSize.determinant()
# 或等价地
volume = O.cell.volume
\`\`\`

### 2.3 简单剪切 vs 纯剪切

#### 简单剪切（Simple Shear）

简单剪切是一种恒定体积的剪切变形，其变形梯度为：

$$
\\mathbf{F}_{\\text{simple}} = \\begin{bmatrix} 1 & \\gamma & 0 \\\\ 0 & 1 & 0 \\\\ 0 & 0 & 1 \\end{bmatrix}
$$

其中 $\\gamma$ 是剪切应变。简单剪切的特点：
- 体积不变（$\\det(\\mathbf{F}) = 1$）
- 主应力方向不断旋转
- 模拟地基水平荷载、地震剪切等情况

在 YADE 中，通过直接修改 hSize 来施加简单剪切：

\`\`\`python
strainIncrement = 0.001  # 每步的剪切应变增量
O.cell.hSize[0, 1] += strainIncrement * O.cell.refSize[1]
\`\`\`

#### 纯剪切（Pure Shear）

纯剪切是主应力方向固定的剪切变形：

$$
\\mathbf{F}_{\\text{pure}} = \\begin{bmatrix} 1+\\varepsilon & 0 & 0 \\\\ 0 & 1-\\varepsilon & 0 \\\\ 0 & 0 & 1 \\end{bmatrix}
$$

其中 $\\varepsilon$ 是剪切应变参数。纯剪切的特点：
- 体积不变
- 主应力方向固定
- 一个方向拉伸，另一个方向压缩

#### 剪胀与剪缩

在颗粒材料的剪切过程中，体积会发生变化：
- **剪胀**（Dilatancy）：体积增大，颗粒需要"爬过"彼此
- **剪缩**（Contractancy）：体积减小，颗粒重新排列更紧密

在恒体积剪切中，剪胀趋势会表现为平均应力的增加（因为材料"想要"
膨胀但被约束）。

### 2.4 PeriTriaxController 与 Peri3dController

#### PeriTriaxController

\`PeriTriaxController\` 是 YADE 中控制周期性盒子变形的引擎，可以
施加应力或应变控制：

\`\`\`python
PeriTriaxController(
    dynCell=True,           # 是否动态更新盒子尺寸
    mass=0.1,               # 盒子的"虚拟质量"
    stressMask=0b011,       # 应力控制的方向掩码
    goalStress=[0, -1e5, -1e5],  # 目标应力
    goalStrain=[0, 0, 0],   # 目标应变
    maxStrainRate=[1, 1, 1],  # 最大应变速率
    label='triax'
)
\`\`\`

\`stressMask\` 是一个三位二进制数：
- 第 0 位（最低位）：x 方向
- 第 1 位：y 方向
- 第 2 位：z 方向
- 1 = 应力控制，0 = 应变控制

例如：
- \`0b011\` = x 和 y 方向应力控制，z 方向应变控制
- \`0b111\` = 三个方向都是应力控制
- \`0b000\` = 三个方向都是应变控制

#### Peri3dController

\`Peri3dController\` 提供更灵活的三维变形控制，可以独立控制
hSize 的每个分量。适用于复杂加载路径，如循环剪切。

### 2.5 周期性模拟中的应力测量

在周期性边界条件下，应力不能通过边界力来测量（因为没有物理边界）。
YADE 提供了基于颗粒接触力的应力张量计算方法：

#### 微观应力张量

\`\`\`python
stressTensor = utils.getStressTensor()
\`\`\`

该函数计算代表性体积单元内的柯西应力张量：

$$
\\sigma_{ij} = \\frac{1}{V} \\sum_c f_i^{(c)} \\times l_j^{(c)}
$$

其中：
- $V$ 是盒子体积
- $f_i^{(c)}$ 是第 $c$ 个接触的接触力矢量
- $l_j^{(c)}$ 是第 $c$ 个接触的接触支量臂矢量
- 求和遍历所有接触

#### 应力不变量

从应力张量可以提取：
- **平均应力**（球应力）：p = (σ_xx + σ_yy + σ_zz) / 3
- **偏应力**（von Mises 应力）：q = √(3J₂)，其中 J₂ 是偏应力第二不变量
- **剪应力**：τ_xy（简单剪切中的主要应力分量）

### 2.6 临界状态

临界状态（Critical State）是颗粒力学中的核心概念：

- 在持续剪切下，颗粒材料最终会达到一个稳定状态
- 此时体积不再变化（dv/dγ = 0），应力比不再变化（dτ/σ_n = 0）
- 颗粒处于持续的剪切流动状态

临界状态的关键特征：
1. **临界孔隙率** e_c：与围压和颗粒性质有关
2. **临界应力比** M = q/p：与颗粒摩擦角有关
3. **临界状态线**（CSL）：在 e - ln(p) 平面上的直线

在 DEM 模拟中，可以通过以下方式观察临界状态：
1. 施加恒定围压下的剪切
2. 观察偏应力比 q/p 是否趋于稳定
3. 观察体积应变是否趋于零

---

## 3. 代码逐行解析

### 3.1 导入与参数设置

\`\`\`python
from yade import pack, plot, utils, qt
from yade.utils import Vector3, Matrix3
import numpy as np
\`\`\`

- \`Matrix3\`：用于操作 hSize 矩阵
- \`numpy\`：用于矩阵运算

### 3.2 创建周期性球体堆积

\`\`\`python
O.periodic = True
O.cell.refSize = Vector3(boxSize, boxSize, boxSize)

sp = pack.SpherePack()
sp.makeCloud(minCorner, maxCorner,
             rMean=rMean, rRelFuzz=rRelFuzz,
             num=numSpheres, periodic=True)
sp.toSimulation()
\`\`\`

关键点：\`periodic=True\` 确保颗粒在周期性盒子内生成。

### 3.3 引擎设置

\`\`\`python
O.engines = [
    ForceResetter(),
    InsertionSortCollider([Bo1_Sphere_Aabb()]),
    InteractionLoop(
        [Ig2_Sphere_Sphere_ScGeom()],
        [Ip2_FrictMat_FrictMat_FrictPhys()],
        [Law2_ScGeom_FrictPhys_CundallStrack()]
    ),
    NewtonIntegrator(damping=0.2),
    PeriTriaxController(...),  # 或手动控制 hSize
    PyRunner(iterPeriod=100, command='collectData()'),
]
\`\`\`

注意：周期性模拟不需要 Bo1_Wall_Aabb 和 Ig2_Wall_Sphere_ScGeom。

### 3.4 剪切加载

#### 方法一：手动修改 hSize

\`\`\`python
def applyShear():
    dGamma = strainRate * O.dt
    O.cell.hSize[0, 1] += dGamma * O.cell.refSize[1]
\`\`\`

#### 方法二：使用 PeriTriaxController

\`\`\`python
PeriTriaxController(
    dynCell=True,
    mass=0.1,
    stressMask=0b010,      # 仅 y 方向应力控制
    goalStress=[0, 0, 0],   # 零围压（自由边界）
    maxStrainRate=[1, 1, 1],
)
\`\`\`

### 3.5 应力测量

\`\`\`python
def collectData():
    # 获取应力张量
    stress = utils.getStressTensor()
    # 剪应力分量
    tau_xy = stress[0, 1]
    # 平均应力
    p = (stress[0, 0] + stress[1, 1] + stress[2, 2]) / 3.0
\`\`\`

### 3.6 体积变化跟踪

\`\`\`python
# 初始盒子体积
V0 = O.cell.hSize.determinant()

# 当前盒子体积
V = O.cell.hSize.determinant()

# 体积应变
volStrain = (V - V0) / V0
\`\`\`

---

## 4. 物理背景与工程意义

### 4.1 简单剪切在工程中的应用

简单剪切试验模拟了许多实际工程条件：
- **地震响应**：地基土层在地震波作用下的剪切变形
- **边坡稳定**：土体沿滑动面的剪切
- **地基承载力**：基础下方土体的剪切破坏
- **挡土墙**：墙后土体的剪切变形

### 4.2 周期性边界在研究中的应用

周期性边界条件广泛用于：
- **本构模型验证**：在均匀应力/应变场中验证本构模型
- **参数敏感性研究**：消除尺寸效应，获得材料固有的力学响应
- **临界状态研究**：模拟无限大均匀介质的稳态行为
- **液化分析**：循环荷载下的孔隙压力积累

### 4.3 剪胀性与塑性

颗粒材料的剪胀性（dilatancy）是其区别于连续介质的重要特征：
- 密实颗粒在剪切时体积膨胀（正剪胀）
- 松散颗粒在剪切时先体积收缩再膨胀（先剪缩后剪胀）
- 剪胀角 ψ 描述了塑性体积变化与塑性剪切变形的关系

---

## 5. 练习题

### 练习 1：不同初始密度的影响

改变初始孔隙率（通过调整颗粒数量），比较：
- 密实试样：观察明显的剪胀现象
- 松散试样：观察先剪缩后剪胀的行为
- 两者最终是否趋向相同的临界状态

\`\`\`python
# 密实试样：较少颗粒
numSpheres_dense = 400
# 松散试样：较多颗粒
numSpheres_loose = 800
\`\`\`

### 练习 2：恒体积 vs 恒压剪切

实现两种不同的剪切控制方式：
- **恒体积剪切**：直接修改 hSize 的剪切分量，不允许体积变化
- **恒压剪切**：使用 PeriTriaxController 控制平均应力恒定

比较两种条件下：
- 剪应力响应
- 体积变化
- 临界状态

### 练习 3：循环剪切

实现循环（往返）简单剪切：
\`\`\`python
def applyCyclicShear():
    period = 10000  # 每个循环的步数
    if O.iter % (2 * period) < period:
        dGamma = strainRate * O.dt
    else:
        dGamma = -strainRate * O.dt
    O.cell.hSize[0, 1] += dGamma * O.cell.refSize[1]
\`\`\`

观察：
- 滞回曲线（τ-γ 关系）
- 孔隙率的演化
- 是否出现液化现象

### 练习 4：纯剪切实现

修改代码实现纯剪切（而非简单剪切），比较：
- 简单剪切：仅修改 hSize[0,1]
- 纯剪切：同时修改 hSize[0,0] 和 hSize[1,1]

\`\`\`python
def applyPureShear():
    dEpsilon = strainRate * O.dt
    O.cell.hSize[0, 0] *= (1 + dEpsilon)
    O.cell.hSize[1, 1] *= (1 - dEpsilon)
\`\`\`

### 练习 5：应力路径分析

绘制不同加载阶段的应力路径：
- p-q 图（平均应力 vs 偏应力）
- e-p 图（孔隙率 vs 平均应力）
- 观察临界状态线

---

## 6. 参考文献

1. Thornton, C. (2000). Numerical simulations of deviatoric shear deformation of granular media. *Géotechnique*, 50(1), 43-53.
2. Cundall, P.A. (1988). Formulation of a three-dimensional distinct element model. *International Journal of Rock Mechanics*, 25(3), 107-116.
3. Šmilauer, V. et al. (2022). *Yade Documentation* — Periodic boundaries chapter. https://yade-dem.org/doc/
4. Radjai, F. & Dubois, F. (2011). *Discrete Numerical Modeling of Granular Materials*. Wiley.
5. Wood, D.M. (1990). *Soil Behaviour and Critical State Soil Mechanics*. Cambridge University Press.
6. Kruyt, N.P. (2003). Statics and kinematics of discrete granular materials. *International Journal of Solids and Structures*, 40(22), 5793-5814.

---

## 7. 进阶阅读

- 一维压缩试验参见项目 \`03_oedometric_test\`
- 三轴试验参见项目 \`06_triaxial_test\`
- 周期性边界下的堆积生成参见项目 \`05_sphere_packing\`
- 更多关于临界状态理论，参见 Wood (1990)`
    },
    5: {
      title: "球体堆积技术",
      level: "intermediate",
      icon: "🟡",
      markdown: `# 项目五：球体堆积技术（Sphere Packing Techniques）

## 1. 项目简介

球体堆积是离散元方法（DEM）模拟的基础工作之一。在开始任何力学试验
模拟之前，首先需要在模拟区域内生成一组球体颗粒，使其具有合理的初始
排列和孔隙率。不同的堆积方法适用于不同的模拟场景。

本项目全面介绍 YADE 中的球体堆积技术，帮助读者掌握：

- SpherePack 类的核心 API
- 谓词（Predicate）系统的使用与布尔运算
- 随机密实堆积（randomDensePack）的原理与参数
- 规则堆积模式（regularHexa、regularOrtho）
- 粒径分布（PSD）的控制与自定义
- 堆积密度的计算与评估
- 堆积的保存与加载
- GTS 表面定义复杂几何形状

### 运行方式

\`\`\`bash
cd /home/faust/vibe/yade_learn/05_sphere_packing
yadedaily sphere_packing.py
\`\`\`

---

## 2. 核心概念详解

### 2.1 SpherePack 类

\`SpherePack\` 是 YADE 中管理球体集合的核心类。它存储了一组球体的
位置和半径信息，但**不会直接创建模拟中的颗粒**（Body）。需要调用
\`toSimulation()\` 方法才能将球体添加到模拟中。

#### 创建 SpherePack

\`\`\`python
sp = pack.SpherePack()  # 创建空的 SpherePack
\`\`\`

#### 核心方法

| 方法 | 说明 |
|------|------|
| \`makeCloud()\` | 在指定区域内生成随机球体堆积 |
| \`makeClumpCloud()\` | 生成团块（clump）堆积 |
| \`randomDensePack()\` | 生成随机密实堆积（使用沉积法） |
| \`fromSimulation()\` | 从当前模拟中提取 SpherePack |
| \`toSimulation()\` | 将 SpherePack 添加到模拟中 |
| \`psd()\` | 设置或获取粒径分布 |
| \`save()\` | 保存到文件 |
| \`load()\` | 从文件加载 |
| \`relDensity()\` | 计算相对密度 |
| \`size()\` | 返回球体数量 |

#### makeCloud() 详解

\`makeCloud()\` 是最常用的堆积生成方法：

\`\`\`python
sp.makeCloud(
    minCorner=(x_min, y_min, z_min),  # 生成区域最小角点
    maxCorner=(x_max, y_max, z_max),  # 生成区域最大角点
    rMean=0.001,                      # 平均半径
    rRelFuzz=0.3,                     # 半径分散度
    num=1000,                         # 目标颗粒数量
    periodic=False,                   # 是否周期性边界
    seed=42                           # 随机种子（可复现）
)
\`\`\`

半径生成规则：

$$
r = r_{\\text{mean}} \\times (1 + r_{\\text{fuzz}} \\times \\text{uniform}(-1, 1))
$$

当 \`rRelFuzz = 0\` 时，所有颗粒半径相等（单分散）。
当 \`rRelFuzz = 0.3\` 时，半径在 0.7×rMean 到 1.3×rMean 之间。

#### toSimulation() 详解

将 SpherePack 中的球体添加到当前模拟：

\`\`\`python
# 方法 1：使用默认材料（O.materials[0]）
ids = sp.toSimulation()

# 方法 2：指定材料
ids = sp.toSimulation(material=myMaterial)

# 方法 3：指定颜色
ids = sp.toSimulation(color=(0.5, 0.5, 0.8))
\`\`\`

返回值是添加的颗粒 Body ID 列表。

#### fromSimulation() 详解

从当前模拟中提取 SpherePack：

\`\`\`python
sp = pack.SpherePack()
sp.fromSimulation()  # 提取 O.bodies 中的所有球体
\`\`\`

这在以下场景中很有用：
- 保存当前状态
- 将沉积后的颗粒移动到新位置
- 在多个模拟间传递颗粒配置

### 2.2 谓词（Predicate）系统

谓词是 YADE 中定义空间区域的数学对象。它们用于：
- 指定 \`randomDensePack\` 的生成区域
- 作为条件判断颗粒是否在某个区域内
- 定义复杂几何形状

#### 基本谓词

| 谓词 | 说明 | 示例 |
|------|------|------|
| \`inAlignedBox()\` | 轴对齐长方体 | \`pack.inAlignedBox((0,0,0), (1,1,1))\` |
| \`inSphere()\` | 球体 | \`pack.inSphere((0.5,0.5,0.5), 0.3)\` |
| \`inCylinder()\` | 圆柱体 | \`pack.inCylinder((0,0,0), (0,0,1), 0.3)\` |
| \`inHyperboloid()\` | 双曲面 | \`pack.inHyperboloid(...)\` |

#### inAlignedBox()

轴对齐长方体谓词：

\`\`\`python
# 定义从 (x0, y0, z0) 到 (x1, y1, z1) 的长方体区域
predicate = pack.inAlignedBox((0, 0, 0), (0.1, 0.1, 0.2))
\`\`\`

#### inSphere()

球形区域谓词：

\`\`\`python
# 中心在 (0.5, 0.5, 0.5)，半径 0.3
predicate = pack.inSphere((0.5, 0.5, 0.5), 0.3)
\`\`\`

#### inCylinder()

圆柱体区域谓词：

\`\`\`python
# 从底面中心 (0, 0, 0) 到顶面中心 (0, 0, 1)，半径 0.3
predicate = pack.inCylinder((0, 0, 0), (0, 0, 1), 0.3)
\`\`\`

#### 布尔运算

谓词支持布尔运算，可以组合出复杂的几何形状：

\`\`\`python
# 并集（Union）：使用 | 运算符
# 区域 A 或区域 B
pred_union = pack.inSphere((0.3, 0.3, 0.3), 0.2) | \\
             pack.inSphere((0.7, 0.7, 0.7), 0.2)

# 交集（Intersection）：使用 & 运算符
# 区域 A 且区域 B
pred_intersect = pack.inAlignedBox((0, 0, 0), (1, 1, 1)) & \\
                 pack.inSphere((0.5, 0.5, 0.5), 0.8)

# 差集（Difference）：使用 - 运算符
# 区域 A 但不在区域 B
pred_hollow = pack.inSphere((0.5, 0.5, 0.5), 0.5) - \\
              pack.inSphere((0.5, 0.5, 0.5), 0.3)
\`\`\`

布尔运算的实际应用：

\`\`\`python
# 圆柱体减去中心球体（空心圆柱）
hollow_cylinder = pack.inCylinder((0,0,0), (0,0,1), 0.5) - \\
                  pack.inCylinder((0,0,0), (0,0,1), 0.2)

# 长方体减去圆柱体（带圆孔的长方体）
box_with_hole = pack.inAlignedBox((0,0,0), (1,1,1)) - \\
                pack.inCylinder((0.5,0.5,-0.1), (0.5,0.5,1.1), 0.3)
\`\`\`

### 2.3 randomDensePack：随机密实堆积

\`randomDensePack()\` 是生成高质量初始堆积的核心方法。它使用**沉积法**
（dropping algorithm）生成密实堆积：

#### 算法原理

1. 在目标区域上方逐个投放颗粒
2. 颗粒在重力作用下自由下落
3. 颗粒沉积后形成自然堆积
4. 当达到目标孔隙率或颗粒数量时停止
5. 去除目标区域外的颗粒

#### 关键参数

\`\`\`python
sp = pack.randomDensePack(
    predicate,              # 空间谓词（定义堆积区域）
    rMean=0.001,           # 平均半径
    rRelFuzz=0.3,          # 半径分散度
    spheresInVolume=1000,  # 目标区域内的颗粒数
    memoizeDb='/tmp/packing.db',  # 数据库文件（缓存）
    seed=42                # 随机种子
)
\`\`\`

#### memoizeDb：缓存数据库

\`randomDensePack\` 的计算可能很耗时。通过指定 \`memoizeDb\` 参数，
可以将生成的堆积缓存到数据库文件中。下次使用相同参数时，直接从
数据库加载，跳过生成过程。

\`\`\`python
# 第一次运行：生成并缓存
sp = pack.randomDensePack(
    pack.inAlignedBox((0,0,0), (0.1,0.1,0.1)),
    rMean=0.001,
    memoizeDb='/tmp/packing_cache.db'
)

# 后续运行：直接从缓存加载
sp = pack.randomDensePack(
    pack.inAlignedBox((0,0,0), (0.1,0.1,0.1)),
    rMean=0.001,
    memoizeDb='/tmp/packing_cache.db'
)
\`\`\`

### 2.4 regularHexa 与 regularOrtho

#### regularHexa()：六方最密堆积

六方最密堆积（HCP）是理论最密堆积方式之一，堆积密度约为 74%。

\`\`\`python
sp = pack.SpherePack()
sp.regularHexa(
    pack.inAlignedBox((0, 0, 0), (0.1, 0.1, 0.1)),
    radius=0.005,
    gap=0.0001  # 颗粒间的间隙
)
\`\`\`

六方堆积的排列模式：
- 每层颗粒呈三角形排列
- 相邻层的颗粒嵌入下层的凹坑中
- ABABAB... 的堆叠顺序

#### regularOrtho()：正交堆积

正交堆积（简单立方堆积）是最简单的规则堆积方式，堆积密度约为 52%。

\`\`\`python
sp = pack.SpherePack()
sp.regularOrtho(
    pack.inAlignedBox((0, 0, 0), (0.1, 0.1, 0.1)),
    radius=0.005,
    gap=0.0001
)
\`\`\`

正交堆积的排列模式：
- 颗粒沿三个坐标轴方向排列
- 形成简单的立方晶格
- 孔隙率较高

### 2.5 PSD（粒径分布）

#### 什么是 PSD？

粒径分布（Particle Size Distribution）描述了颗粒集合体中不同粒径
颗粒的比例关系。它是影响颗粒材料力学行为的关键因素之一。

常见的 PSD 表示方法：
- **级配曲线**（Grading Curve）：粒径 vs 小于该粒径的质量百分比
- **均匀系数** Cu = d60 / d10
- **曲率系数** Cc = (d30)² / (d10 × d60)

#### psd() 方法

YADE 的 \`SpherePack.psd()\` 方法用于设置或获取粒径分布：

\`\`\`python
# 设置自定义 PSD
# psdSizes：粒径列表（从大到小排列）
# psdCumm：累积通过百分比（0 到 1）
sp.psd(
    sizes=[0.005, 0.003, 0.001],  # 粒径 [m]
    cumm=[0.0, 0.5, 1.0],         # 累积百分比
    mass=True                      # 基于质量的分布
)
\`\`\`

#### 质量分布 vs 数量分布

- **质量分布**（mass-based）：指定每种粒径颗粒的质量百分比
- **数量分布**（number-based）：指定每种粒径颗粒的数量百分比

对于相同的质量分布，大颗粒数量少，小颗粒数量多。

\`\`\`python
# 质量分布（更常用）
sp.psd(sizes=[0.005, 0.003, 0.001],
       cumm=[0.0, 0.5, 1.0],
       mass=True)

# 数量分布
sp.psd(sizes=[0.005, 0.003, 0.001],
       cumm=[0.0, 0.5, 1.0],
       mass=False)
\`\`\`

#### 常见的 PSD 类型

1. **单分散**（Monodisperse）：所有颗粒粒径相同
   - 均匀系数 Cu = 1
   - 堆积密度较低（随机堆积约 64%）

2. **双分散**（Bidisperse）：两种粒径的颗粒混合
   - 大小颗粒的比例影响堆积密度
   - 当大小比约为 7:1 时，堆积密度最高

3. **连续级配**（Well-graded）：粒径连续分布
   - 均匀系数 Cu > 4
   - 堆积密度高

4. **间断级配**（Gap-graded）：缺少某些粒径范围
   - 存在明显的粒径"跳跃"
   - 用于模拟特定工程材料

### 2.6 堆积密度

#### relDensity() 方法

\`SpherePack\` 提供了 \`relDensity()\` 方法计算相对密度：

\`\`\`python
# 计算相对密度（相对于最大理论密度）
rd = sp.relDensity()
print(f"相对密度: {rd:.4f}")
\`\`\`

#### 孔隙率的计算

孔隙率（porosity）n 定义为：

$$
n = \\frac{V_{\\text{void}}}{V_{\\text{total}}} = 1 - \\frac{V_{\\text{solid}}}{V_{\\text{total}}}
$$

在 DEM 中的计算方法：

\`\`\`python
# 方法 1：使用 SpherePack 计算
# 只需要知道颗粒总体积和容器体积
V_spheres = sum((4/3) * pi * r**3 for r in sp.radii())
V_container = ...  # 容器体积
porosity = 1 - V_spheres / V_container

# 方法 2：使用 YADE 的 Porosity 计算器
from yade import utils
porosity = utils.porosity()
\`\`\`

#### 影响堆积密度的因素

1. **粒径分布**：多分散颗粒比单分散颗粒堆积更密
2. **颗粒形状**：非球形颗粒（如椭球）可以达到更高密度
3. **生成方法**：振动压实比自由沉积密度更高
4. **摩擦角**：摩擦角越小，沉积越紧密
5. **生成速率**：缓慢沉积比快速沉积更密实

### 2.7 GTS 表面

GTS（GNU Triangulated Surface）是一种用于定义三维表面的格式。
在 YADE 中，可以使用 GTS 表面定义复杂的几何边界，然后在该边界
内生成球体堆积。

#### 基本用法

\`\`\`python
# 从 GTS 文件加载表面
surf = pack.gtsSurface2Facets('/path/to/surface.gts')

# 使用 GTS 表面作为谓词生成堆积
predicate = pack.inGtsSurface('/path/to/surface.gts')
sp = pack.randomDensePack(
    predicate,
    rMean=0.001,
    rRelFuzz=0.3
)
\`\`\`

#### 创建简单 GTS 表面

\`\`\`python
# 使用 YADE 内置函数创建常见几何形状
# 半球
surf = pack.gtsSurface2Facets(
    gts.Surface(
        # ... 定义顶点和面
    )
)
\`\`\`

---

## 3. 代码逐行解析

### 3.1 导入与参数设置

\`\`\`python
from yade import pack, plot, utils, qt
import numpy as np
import math
\`\`\`

### 3.2 方法一：makeCloud 基础堆积

最简单的堆积生成方式：

\`\`\`python
sp = pack.SpherePack()
sp.makeCloud((0, 0, 0), (0.1, 0.1, 0.1),
             rMean=0.005, rRelFuzz=0.3, num=500)
ids = sp.toSimulation()
\`\`\`

### 3.3 方法二：randomDensePack 密实堆积

使用沉积法生成更紧密的堆积：

\`\`\`python
sp = pack.randomDensePack(
    pack.inAlignedBox((0, 0, 0), (0.1, 0.1, 0.1)),
    rMean=0.005,
    rRelFuzz=0.3,
    spheresInVolume=500,
    memoizeDb='/tmp/packing.db'
)
\`\`\`

### 3.4 方法三：regularHexa 规则堆积

\`\`\`python
sp = pack.SpherePack()
sp.regularHexa(
    pack.inAlignedBox((0, 0, 0), (0.1, 0.1, 0.1)),
    radius=0.005, gap=0.0001
)
\`\`\`

### 3.5 谓词布尔运算示例

\`\`\`python
# 圆柱体减去中心圆柱体 = 空心圆柱
pred = pack.inCylinder((0, 0, 0), (0, 0, 0.1), 0.05) - \\
       pack.inCylinder((0, 0, 0), (0, 0, 0.1), 0.02)
\`\`\`

### 3.6 PSD 控制

\`\`\`python
sp = pack.SpherePack()
sp.makeCloud((0, 0, 0), (0.1, 0.1, 0.1), num=1000, periodic=True)
# 应用自定义 PSD
sp.psd(sizes=[0.005, 0.003, 0.001, 0.0005],
       cumm=[0.0, 0.3, 0.7, 1.0],
       mass=True)
\`\`\`

---

## 4. 物理背景与工程意义

### 4.1 堆积密度的工程意义

堆积密度直接影响颗粒材料的力学行为：
- **密实堆积**：剪切强度高，剪胀性显著，刚度大
- **松散堆积**：剪切强度低，可能液化，压缩性大

### 4.2 级配设计

在实际工程中，骨料的级配设计是混凝土和沥青混合料设计的核心：
- **连续级配**：最大密实度，常用于混凝土
- **间断级配**：特定力学性能，常用于排水基层
- **单一级配**：孔隙率大，常用于过滤层

### 4.3 DEM 中的堆积生成策略

选择合适的堆积生成方法取决于模拟目标：

| 场景 | 推荐方法 | 原因 |
|------|----------|------|
| 快速原型 | makeCloud | 速度快，参数简单 |
| 力学试验 | randomDensePack | 密实度高，物理合理 |
| 规则排列研究 | regularHexa/Ortho | 可控的初始状态 |
| 复杂几何 | randomDensePack + 谓词 | 灵活的边界形状 |

---

## 5. 练习题

### 练习 1：不同 PSD 的堆积密度

生成三种不同 PSD 的堆积，比较孔隙率：
- 单分散：所有颗粒半径相同
- 双分散：大小比 3:1，体积比 1:1
- 连续级配：均匀系数 Cu > 4

\`\`\`python
# 单分散
sp1.makeCloud(minC, maxC, rMean=0.002, rRelFuzz=0, num=500)

# 双分散
sp2.makeCloud(minC, maxC, rMean=0.002, rRelFuzz=0.6, num=500)

# 连续级配
sp3.makeCloud(minC, maxC, rMean=0.002, rRelFuzz=0.8, num=500)
\`\`\`

### 练习 2：谓词组合

使用谓词布尔运算创建以下形状内的堆积：
1. 空心球体：大球减去小球
2. L 形区域：两个长方体的并集
3. 带孔长方体：长方体减去圆柱体

### 练习 3：堆积密度优化

通过以下方法尝试提高 \`makeCloud\` 生成的堆积密度：
1. 减小摩擦角后再沉积
2. 使用振动压实（周期性压缩边界）
3. 使用 \`randomDensePack\` 替代 \`makeCloud\`

### 练习 4：保存与加载

练习 SpherePack 的保存和加载：
\`\`\`python
# 保存
sp.save('/tmp/my_packing.txt')
sp.save('/tmp/my_packing.bin')  # 二进制格式更快

# 加载
sp2 = pack.SpherePack()
sp2.load('/tmp/my_packing.txt')
\`\`\`

### 练习 5：圆柱体内的堆积

使用 \`inCylinder\` 谓词在圆柱体内生成堆积，并计算：
1. 孔隙率沿高度的分布
2. 配位数的分布
3. 与长方体区域堆积的对比

\`\`\`python
# 圆柱体谓词
cyl_pred = pack.inCylinder(
    centerBottom=(0, 0, 0),   # 底面中心
    centerTop=(0, 0, 0.1),    # 顶面中心
    radius=0.03               # 半径
)
sp = pack.randomDensePack(cyl_pred, rMean=0.002, spheresInVolume=300)
\`\`\`

### 练习 6：周期性 vs 非周期性堆积

比较周期性和非周期性堆积的差异：
\`\`\`python
# 周期性堆积
sp_peri.makeCloud(minC, maxC, rMean=0.002, num=500, periodic=True)

# 非周期性堆积
sp_nonp.makeCloud(minC, maxC, rMean=0.002, num=500, periodic=False)
\`\`\`

观察：
- 边界处颗粒的排列差异
- 孔隙率的差异
- 在力学加载中边界效应的表现

---

## 6. 参考文献

1. Šmilauer, V. et al. (2022). *Yade Documentation* — Packing module. https://yade-dem.org/doc/
2. Torquato, S. (2002). *Random Heterogeneous Materials: Microstructure and Macroscopic Properties*. Springer.
3. Donev, A. et al. (2004). Improving the density of jammed disordered packings using ellipsoids. *Science*, 303(5660), 990-993.
4. Furnas, C.C. (1931). Grading aggregates. *Industrial & Engineering Chemistry*, 23(10), 1052-1058.
5. German, R.M. (1989). *Particle Packing Characteristics*. Metal Powder Industries Federation.
6. Aste, T. & Weaire, D. (2008). *The Pursuit of Perfect Packing*. CRC Press.

---

## 7. 进阶阅读

- 使用本项目的堆积进行力学试验，参见项目 \`03_oedometric_test\` 和 \`06_triaxial_test\`
- 周期性边界条件下的堆积生成，参见项目 \`04_periodic_shear\`
- 非球形颗粒（clump）的堆积，参见项目 \`08_clumps_breakage\``
    },
    6: {
      title: "三轴试验",
      level: "advanced",
      icon: "🔴",
      markdown: `# 06 三轴试验 —— 颗粒材料的经典力学试验

## 1. 项目简介

三轴试验（Triaxial Test）是岩土力学中最经典的室内试验之一，用于测定土体和颗粒
材料的抗剪强度参数（内摩擦角 φ 和粘聚力 c）。在本项目中，我们将使用 YADE 的
**周期性边界条件**和 **PeriTriaxController** 引擎，模拟一个完整的三轴试验过程：

1. **各向同性固结** (Isotropic Consolidation)：在三个方向施加相同的围压，使颗粒
   试样达到初始力学平衡
2. **偏应力加载** (Deviatoric Loading)：保持围压不变，增大轴向应力，直至试样破坏

通过本教程，你将掌握：
- 周期性边界条件下的三轴试验模拟方法
- PeriTriaxController 的使用和参数调节
- 应力不变量（平均应力 p 和偏应力 q）的计算
- 莫尔圆和临界状态线的概念
- VTK 文件输出和 ParaView 后处理
- 体变行为（剪缩与剪胀）的观察

---

## 2. 核心概念详解

### 2.1 三轴试验原理

#### 2.1.1 常规三轴试验

常规三轴试验 (Conventional Triaxial Test) 的基本步骤：

1. **安装试样**：将圆柱形颗粒试样放入压力室，施加围压 σ₃
2. **各向同性固结**：在 σ₁ = σ₂ = σ₃ 条件下等待试样稳定
3. **偏应力加载**：保持 σ₂ = σ₃ 不变，逐步增大 σ₁ 直到试样破坏

应力状态的变化过程可以用 p-q 空间来描述：

$$
p = \\frac{\\sigma_1 + \\sigma_2 + \\sigma_3}{3} \\quad \\text{(平均应力/球应力)}
$$

$$
q = \\sigma_1 - \\sigma_3 \\quad \\text{(偏应力/剪应力)}
$$

在三轴压缩试验中：
- **固结阶段**：p 增大，q = 0（应力路径沿 p 轴上升）
- **加载阶段**：p 和 q 同时增大，应力路径斜率为 dp/dq = 1/3
  （因为 σ₁ 增大而 σ₂ = σ₃ 不变，所以 Δp = Δσ₁/3，Δq = Δσ₁）

#### 2.1.2 为什么使用周期性边界？

传统的三轴试验模拟需要在试样顶部和底部设置加载板，在侧面设置柔性膜或刚性壁。
这种方式存在以下问题：

- **边界效应**：颗粒与刚性壁之间的接触行为与颗粒间的接触不同
- **端部约束**：加载板与试样之间的摩擦会引入非均匀应力场
- **网格生成**：需要精心设计初始堆积以获得均匀的试样

**周期性边界** (Periodic Boundary) 完全消除了这些边界效应。在周期性条件下：
- 试样在三个方向无限重复，没有"墙壁"
- 均匀变形，无端部效应
- 应力和应变在整个试样中均匀分布
- 特别适合研究材料的本构行为

当然，代价是无法模拟局部化现象（如剪切带）和自由表面。

### 2.2 PeriTriaxController

\`PeriTriaxController\` 是 YADE 中用于在周期性边界条件下控制应力的引擎。它是模拟
三轴试验的核心工具。

#### 2.2.1 工作原理

PeriTriaxController 通过调整周期性盒子 (O.cell.hSize) 的尺寸来控制应力：

\`\`\`
目标应力 σᵢⱼ → 计算当前应力与目标的差距 → 调整盒子尺寸变化速率 → 逐步趋近目标
\`\`\`

这是一个反馈控制过程，类似于伺服控制加载系统。

#### 2.2.2 核心参数

| 参数 | 含义 | 示例 |
|------|------|------|
| \`goal\` | 目标应力值，三维向量 (σ_xx, σ_yy, σ_zz) | (-1e5, -1e5, -1e5) |
| \`stressMask\` | 控制哪些方向的应力 | 7 = 全部三个方向 |
| \`maxUnbalanced\` | 最大不平衡力阈值（收敛判据） | 0.1 |
| \`globUpdate\` | 全局应力更新频率 | 10（每 10 步更新一次） |
| \`maxStrainRate\` | 最大应变速率限制 | (0.1, 0.1, 0.1) |
| \`stressRateMask\` | 应力变化速率控制 | (1, 1, 1) |

**关于 stressMask**：

\`stressMask\` 是一个位掩码 (bitmask)，控制哪些方向由应力控制、哪些方向由应变控制：

| stressMask 值 | xx 方向 | yy 方向 | zz 方向 | 含义 |
|---------------|---------|---------|---------|------|
| 0 | 应变控制 | 应变控制 | 应变控制 | 纯应变控制 |
| 1 | 应力控制 | 应变控制 | 应变控制 | 仅控制 σ_xx |
| 3 | 应力控制 | 应力控制 | 应变控制 | 控制 σ_xx 和 σ_yy |
| 7 | 应力控制 | 应力控制 | 应力控制 | 三向应力控制 |

计算方式：\`stressMask = 1×(控制xx) + 2×(控制yy) + 4×(控制zz)\`

在三轴试验中的应用：
- **固结阶段**：\`stressMask = 7\`，三个方向都控制为目标围压
- **加载阶段**：\`stressMask = 5\`（二进制 101），仅控制 σ_xx 和 σ_zz 为目标围压，
  σ_yy 方向自由增加（对应 σ₁ 方向）

#### 2.2.3 goal 的符号约定

在 YADE 中，**压应力为负**，这是力学中的标准约定。因此：
- 围压 100 kPa → goal = -1e5
- 拉应力 50 kPa → goal = 5e4

#### 2.2.4 两阶段控制策略

\`\`\`python
# 阶段 1：各向同性固结
# 三方向都控制到目标围压
PeriTriaxController(
    goal=(-confiningPressure, -confiningPressure, -confiningPressure),
    stressMask=7,     # 三向应力控制
    maxUnbalanced=0.1,
    ...
)

# 阶段 2：偏应力加载
# xx 和 zz 方向保持围压，yy 方向自由增大
PeriTriaxController(
    goal=(-confiningPressure, 0, -confiningPressure),
    stressMask=5,     # 仅控制 xx 和 zz (1 + 4 = 5)
    maxUnbalanced=0.1,
    ...
)
\`\`\`

### 2.3 应力不变量

在三维应力状态下，应力张量可以分解为球应力（静水压力）和偏应力（剪应力）两部分。

#### 2.3.1 应力张量

$$
\\boldsymbol{\\sigma} = \\begin{bmatrix}
\\sigma_{xx} & \\sigma_{xy} & \\sigma_{xz} \\\\
\\sigma_{yx} & \\sigma_{yy} & \\sigma_{yz} \\\\
\\sigma_{zx} & \\sigma_{zy} & \\sigma_{zz}
\\end{bmatrix}
$$

在三轴试验中（无剪应力交叉项），简化为：

$$
\\boldsymbol{\\sigma} = \\begin{bmatrix}
\\sigma_1 & 0 & 0 \\\\
0 & \\sigma_2 & 0 \\\\
0 & 0 & \\sigma_3
\\end{bmatrix}
$$

#### 2.3.2 平均应力 p（Mean Stress / Volumetric Stress）

$$
p = \\frac{\\sigma_1 + \\sigma_2 + \\sigma_3}{3} = \\frac{\\operatorname{tr}(\\boldsymbol{\\sigma})}{3}
$$

p 表征了应力的球张量部分，即静水压力分量。p 增大意味着试样被"压缩"。

#### 2.3.3 偏应力 q（Deviatoric Stress）

对于常规三轴试验 (σ₂ = σ₃)：

$$
q = \\sigma_1 - \\sigma_3
$$

更一般的形式（von Mises 偏应力）：

$$
q = \\sqrt{3 J_2}
$$

其中 J₂ 是偏应力第二不变量：

$$
J_2 = \\frac{1}{6}\\left[(\\sigma_1 - \\sigma_2)^2 + (\\sigma_2 - \\sigma_3)^2 + (\\sigma_3 - \\sigma_1)^2\\right]
$$

q 表征了应力的偏张量部分，即剪应力分量。q 增大意味着试样被"剪切"。

#### 2.3.4 p-q 空间

p-q 空间是描述三轴试验应力路径的最佳工具：

\`\`\`
  q (偏应力)
  ^
  |         /  ← 加载阶段（斜率 = 3 for 压缩, -3 for 拉伸）
  |        /
  |       /
  |      /
  |     /   ← 临界状态线 (CSL)
  |    /
  |   /
  |  /
  | /
  |/__________________________→ p (平均应力)
  O  ← 固结阶段（沿 p 轴）
\`\`\`

### 2.4 莫尔圆 (Mohr's Circle)

莫尔圆是二维应力空间中的经典表示方法，用于可视化任意截面上的正应力和剪应力。

#### 2.4.1 莫尔圆的构造

对于主应力 σ₁ > σ₂ > σ₃，莫尔圆的参数为：
- 圆心：((σ₁ + σ₃)/2, 0)
- 半径：(σ₁ - σ₃)/2 = q/2

任意截面（法向与 σ₁ 方向夹角为 θ）上的应力为：
- 正应力：σ_n = (σ₁ + σ₃)/2 + (σ₁ - σ₃)/2 · cos(2θ)
- 剪应力：τ = (σ₁ - σ₃)/2 · sin(2θ)

#### 2.4.2 破坏包络线

当莫尔圆增大到与材料的破坏包络线相切时，试样发生破坏。对于 Mohr-Coulomb
材料：

$$
\\tau = c + \\sigma_n \\cdot \\tan\\varphi
$$

其中 c 为粘聚力，φ 为内摩擦角。在 DEM 模拟的纯摩擦材料中，c = 0。

### 2.5 临界状态线 (Critical State Line, CSL)

临界状态是颗粒材料力学中的核心概念。当试样在剪切过程中达到以下状态时，称其处于
临界状态：

- **应力不变**：p 和 q 不再变化
- **体积不变**：体积应变不再变化
- **孔隙率不变**：临界状态孔隙率 e_c

在 p-q 空间中，临界状态线 (CSL) 通过原点：

$$
q = M \\cdot p
$$

其中 M 是临界状态线的斜率，与内摩擦角 φ 的关系为：

$$
M = \\frac{6\\sin\\varphi}{3 - \\sin\\varphi} \\quad \\text{(三轴压缩)}
$$

$$
M = \\frac{6\\sin\\varphi}{3 + \\sin\\varphi} \\quad \\text{(三轴拉伸)}
$$

在 e-ln(p) 空间（孔隙率 vs 平均应力的对数）中，CSL 是一条直线：

$$
e_c = \\Gamma - \\lambda \\cdot \\ln p
$$

其中 Γ 和 λ 是材料常数。

### 2.6 体变行为

颗粒材料在剪切过程中会发生体积变化，这是 DEM 最重要的发现之一：

#### 2.6.1 剪缩 (Contractive)

- **条件**：松散堆积（初始孔隙率高于临界孔隙率）
- **行为**：剪切初期体积减小，颗粒重排到更紧密的状态
- **物理机制**：颗粒需要"爬过"邻近颗粒，但初始间隙较大，容易塌缩到更紧密排列

#### 2.6.2 剪胀 (Dilative)

- **条件**：密实堆积（初始孔隙率低于临界孔隙率）
- **行为**：剪切过程中体积增大
- **物理机制**：颗粒必须"翻越"邻近颗粒才能继续剪切，导致体积增大

剪胀现象最早由 Reynolds (1885) 发现，后来被 Taylor (1948) 和 Roscoe 等 (1958)
系统研究。它是颗粒材料区别于连续介质的最重要特征之一。

#### 2.6.3 孔隙率与临界状态

\`\`\`
e (孔隙率)
^
|  初始松散  ·····→ 剪缩 → 临界状态
|              ↘
|               ····················  CSL (临界孔隙率 e_c)
|              ↗
|  初始密实  ·····→ 剪胀 → 临界状态
|
+----------------------------------------→ ln(p)
\`\`\`

无论初始密实还是松散，最终都会趋向同一个临界状态孔隙率（在相同围压下）。

### 2.7 VTKRecorder — ParaView 后处理

\`VTKRecorder\` 是 YADE 内置的引擎，用于将仿真结果保存为 VTK 格式文件，可在
ParaView 中进行可视化后处理。

\`\`\`python
VTKRecorder(
    fileName='/tmp/triaxial/',   # 输出文件路径前缀
    recorders=['spheres', 'stress', 'velocity'],  # 记录的数据类型
    iterPeriod=1000,             # 每 1000 步记录一次
    globUpdate=True              # 使用全局更新
)
\`\`\`

常用记录器类型：
- \`spheres\`：颗粒位置、半径、颜色
- \`stress\`：每个颗粒的应力张量
- \`velocity\`：颗粒速度
- \`force\`：接触力链
- \`intrs\`：接触信息
- \`colors\`：自定义颜色属性

输出文件：
- \`spheres_*.vtu\`：非结构化网格文件，包含球体数据
- \`*_*.vtk\`：VTK 格式数据文件

### 2.8 孔隙率测量

在周期性边界条件下，孔隙率的计算非常直接：

$$
n = 1 - \\frac{V_{\\text{spheres}}}{V_{\\text{box}}}
$$

其中：
- V_spheres 是所有颗粒体积之和
- V_box = det(hSize) 是周期性盒子的体积

颗粒总体积的计算：

$$
V_{\\text{spheres}} = \\sum_i \\frac{4}{3} \\pi r_i^3
$$

在 YADE 中：

\`\`\`python
def computePorosity():
    """计算当前孔隙率"""
    # 颗粒总体积
    volSpheres = sum(
        (4.0/3.0) * math.pi * b.shape.radius**3
        for b in O.bodies
        if isinstance(b.shape, Sphere)
    )
    # 盒子体积
    volBox = O.cell.hSize.determinant()
    # 孔隙率
    return 1.0 - volSpheres / volBox
\`\`\`

---

## 3. 代码逐行解析

### 3.1 参数定义

\`\`\`python
confiningPressure = 100e3   # 围压 100 kPa
\`\`\`

围压是三轴试验的关键参数。100 kPa 约等于 1 个大气压，是常见的低围压水平。
不同的围压会导致不同的应力-应变曲线和破坏模式。

\`\`\`python
young = 5e6     # 杨氏模量 5 MPa
poisson = 0.3   # 泊松比
frictionAngle = 0.524   # 摩擦角约 30°
density = 2600  # 密度（砂土典型值）
\`\`\`

杨氏模量控制颗粒的刚度。这里选择 5 MPa 是一个适中的值。太大会需要更小的时间步，
太小则颗粒过"软"。

### 3.2 周期性堆积生成

\`\`\`python
O.periodic = True
O.cell.refSize = Vector3(side, side, side)
sp.makeCloud(..., periodic=True)
\`\`\`

\`periodic=True\` 是关键，它告诉 makeCloud 在周期性盒子内生成颗粒，确保没有边界。

\`randomDensePack()\` 与 \`makeCloud()\` 的区别：
- \`makeCloud()\`：简单地在指定区域内随机放置球体（可能有重叠）
- \`randomDensePack()\`：使用下投法生成致密堆积，需要更多计算时间但结果更好

### 3.3 引擎管线

标准管线包含：
1. ForceResetter：力清零
2. InsertionSortCollider：碰撞检测
3. InteractionLoop：接触力计算
4. NewtonIntegrator：运动积分
5. PeriTriaxController：应力控制（后续动态添加）

### 3.4 各向同性固结

\`\`\`python
triax = PeriTriaxController(
    goal=(-confiningPressure, -confiningPressure, -confiningPressure),
    stressMask=7,
    maxUnbalanced=0.1,
    ...
)
\`\`\`

固结阶段的目标是让三个方向的应力都达到围压值。\`stressMask=7\` 表示三个方向都由
应力控制。当不平衡力 (unbalanced force) 低于 \`maxUnbalanced\` 阈值时，系统认为
达到平衡。

### 3.5 偏应力加载

加载阶段的关键改变：
- \`goal\` 中 yy 方向设为 0（不控制，允许自由增大）
- \`stressMask=5\`（二进制 101），仅控制 xx 和 zz 方向

这意味着 σ₁ (= σ_yy) 将持续增大，直到试样破坏。

### 3.6 数据采集

在数据采集中，我们需要计算：
- 应力张量 → p 和 q
- 体积应变 → 体变行为
- 孔隙率 → 微观结构变化

---

## 4. 运行与观察

### 4.1 运行方法

\`\`\`bash
cd 06_triaxial_test
yadedaily triaxial_test.py
\`\`\`

### 4.2 预期结果

运行完成后，你将看到：

1. **应力-应变曲线 (q vs ε_a)**：
   - 初始阶段斜率较陡（弹性阶段）
   - 达到峰值后应力逐渐下降（软化）或趋于水平（理想塑性）
   - 曲线形状取决于围压和初始孔隙率

2. **体变曲线 (ε_v vs ε_a)**：
   - 松散试样：先剪缩后趋平
   - 密实试样：先微剪缩后持续剪胀

3. **p-q 图**：
   - 固结阶段：沿 p 轴上升
   - 加载阶段：斜率 1/3 的直线
   - 数据点最终趋向临界状态线

### 4.3 ParaView 后处理

如果启用了 VTKRecorder，输出文件保存在 \`/tmp/triaxial_vtk/\` 目录。在 ParaView 中：

1. 打开 ParaView，File → Open，选择 \`spheres_*.vtu\` 文件
2. 点击 Apply，即可看到三维颗粒模型
3. 可以用颜色映射显示应力、速度等场量
4. 使用 "Animation" 功能播放时间序列

---

## 5. 练习题

### 练习 1：不同围压

修改围压分别为 50 kPa、100 kPa、200 kPa，分别运行模拟。

**思考题**：
- 围压增大时，峰值偏应力如何变化？
- 试样最终趋向的临界状态孔隙率是否相同？
- 不同围压的 p-q 图中，数据点是否趋向同一条直线？

### 练习 2：不同初始孔隙率

通过修改 \`rRelFuzz\` 参数或使用 \`randomDensePack\` 替代 \`makeCloud\` 来改变初始
孔隙率。对比松散和密实试样的行为差异。

**思考题**：
- 密实试样是否表现出更强的剪胀？
- 松散试样是否表现出更多的剪缩？
- 两种试样的峰值摩擦角是否相同？

### 练习 3：应力路径分析

修改脚本，在 p-q 空间中绘制完整的应力路径。添加临界状态线 q = M·p 作为参考。

**提示**：
\`\`\`python
# 计算 M 值
import math
phi = frictionAngle
M = 6 * math.sin(phi) / (3 - math.sin(phi))
print(f"临界状态线斜率 M = {M:.3f}")
\`\`\`

### 练习 4：VTK 可视化

启用 VTKRecorder，使用 ParaView 打开输出文件，观察：
- 颗粒的运动模式
- 接触力链的发展
- 应力场的分布

---

## 6. 延伸阅读

- [YADE 官方文档 — Periodic Triaxial Test](https://yade-dem.org/doc/tutorial-periodic-triax.html)
- Wood, D.M. (1990). Soil Behaviour and Critical State Soil Mechanics. Cambridge University Press.
- Cundall, P.A. & Strack, O.D.L. (1979). A discrete numerical model for granular assemblies. Géotechnique, 29(1), 47-65.
- Thornton, C. (2000). Numerical simulations of deviatoric shear deformation of granular granules. Géotechnique, 50(1), 43-53.
- Radjai, F. & Dubois, F. (Eds.) (2011). Discrete-element Modeling of Granular Materials. Wiley-ISTE.

---

**上一课**：[05 球体堆积](../05_sphere_packing/) —— 学习球体堆积的生成方法。

**下一课**：[07 混凝土力学](../07_concrete_mechanics/) —— 学习使用 Cpm 模型模拟混凝土。`
    },
    7: {
      title: "混凝土力学",
      level: "advanced",
      icon: "🔴",
      markdown: `# 07 混凝土力学 —— 粘结颗粒模型 (Cpm) 模拟

## 1. 项目简介

混凝土是由水泥、骨料（砂石）和水混合而成的复合材料。与砂土等颗粒材料不同，混凝土
具有显著的**粘聚力**和**拉伸强度**，其力学行为涉及**损伤**、**开裂**和**软化**等复杂过程。

在本项目中，我们使用 YADE 内置的 **Cpm (Cohesive Particle Model)** 模型来模拟
混凝土的单轴拉伸试验。Cpm 模型通过在颗粒间引入**粘结力**（cohesive force）来模拟
水泥基材料的力学特性。

通过本教程，你将掌握：
- CpmMat 材料模型及其参数的物理含义
- CpmPhys 接触物理中损伤变量 (damage) 的演化规律
- Law2_ScGeom_CpmPhys_Cpm 本构律的工作原理
- CpmStateUpdater 的作用
- 使用 UniaxialStrainer 进行单轴拉伸试验
- 裂纹萌生、扩展和贯通的模拟方法
- 应力-应变全曲线（含软化段）的获取

---

## 2. 核心概念详解

### 2.1 CpmMat 材料模型

\`CpmMat\` 是 YADE 中用于模拟粘结颗粒材料（如混凝土、岩石）的材料模型。与基础的
\`FrictMat\` 不同，CpmMat 额外引入了拉伸强度和损伤演化参数。

#### 2.1.1 参数列表

| 参数 | 含义 | 典型值 | 说明 |
|------|------|--------|------|
| \`young\` | 杨氏模量 [Pa] | 30e9 | 混凝土约 30 GPa |
| \`poisson\` | 泊松比 | 0.2 | 混凝土约 0.15~0.25 |
| \`frictionAngle\` | 摩擦角 [rad] | 0.6 | 接触摩擦角 |
| \`density\` | 密度 [kg/m³] | 2500 | 混凝土密度 |
| \`sigmaT\` | 拉伸强度 [Pa] | 3e6 | 混凝土约 2~5 MPa |
| \`relDuctility\` | 相对延性 | 0.1 | 控制软化段的陡峭程度 |
| \`epsCrackOnset\` | 开裂应变 | 1e-4 | 损伤开始累积的应变阈值 |
| \`isoPrestress\` | 各向同性预应力 [Pa] | 0 | 模拟预应力混凝土 |

#### 2.1.2 关键参数详解

**sigmaT（拉伸强度）**：

这是 Cpm 模型最重要的参数之一。它定义了接触能够承受的最大拉力。当接触法向力
达到 $\\sigma_T \\times A_{\\text{eff}}$（有效面积）时，接触开始产生损伤。

在混凝土中，拉伸强度远小于压缩强度（典型比值 ft/fc ≈ 1/10 ~ 1/15），这种
不对称性是混凝土最重要的力学特征。Cpm 模型自然地捕捉了这一点，因为：
- 压缩时：颗粒相互靠近，接触摩擦发挥作用，承载力较大
- 拉伸时：仅靠粘结力抵抗，一旦超过 sigmaT 就开始损伤

**relDuctility（相对延性）**：

这个参数控制损伤发展的速度和应力-应变曲线软化段的形状：
- \`relDuctility\` 小（如 0.01）：脆性断裂，应力急剧下降
- \`relDuctility\` 大（如 0.5）：延性行为，应力缓慢下降

在物理上，它与断裂能 (fracture energy) 相关。较大的 relDuctility 意味着破坏
过程中消耗更多的能量。

**epsCrackOnset（开裂应变）**：

定义了损伤开始累积的应变阈值。当接触的法向应变小于 epsCrackOnset 时，接触保持
完好无损（d = 0）。超过此值后，损伤开始演化。

这个参数的存在使得应力-应变曲线在初始阶段呈线弹性。

#### 2.1.3 等效参数计算

当两个 CpmMat 材料的颗粒发生接触时，接触参数由 \`Ip2_CpmMat_CpmMat_CpmPhys\`
通过以下方式计算：

$$
E_{\\text{eff}} = \\frac{2 E_1 E_2}{E_1 + E_2} \\quad \\text{(等效杨氏模量，调和平均)}
$$

$$
\\sigma_{T,\\text{eff}} = \\min(\\sigma_{T_1}, \\sigma_{T_2}) \\quad \\text{(等效拉伸强度，取较小值)}
$$

$$
d_{\\text{eff}} = \\frac{d_1 + d_2}{2} \\quad \\text{(等效延性，算术平均)}
$$

### 2.2 CpmPhys 接触物理

\`CpmPhys\` 是 Cpm 模型中每个接触的物理属性存储对象。它记录了接触的力-位移关系和
损伤状态。

#### 2.2.1 核心属性

| 属性 | 含义 |
|------|------|
| \`normalForce\` | 法向力向量（正值=拉伸，负值=压缩） |
| \`shearForce\` | 切向力向量 |
| \`kn\` | 法向刚度 |
| \`ks\` | 切向刚度 |
| \`sigmaN\` | 法向应力 |
| \`sigmaT\` | 切向应力 |
| \`damage\` | 损伤变量 d ∈ [0, 1] |
| \`epsN\` | 法向应变 |
| \`epsT\` | 切向应变 |
| \`crackOnset\` | 是否已开始损伤 |

#### 2.2.2 损伤变量 d

损伤变量 d 是 Cpm 模型的核心概念，取值范围 [0, 1]：
- **d = 0**：完好无损，接触承受全部荷载
- **0 < d < 1**：部分损伤，接触刚度退化
- **d = 1**：完全破坏，接触不能承受拉力

有效刚度的退化公式：

$$
k_n^{\\text{eff}} = k_n (1 - d)
$$

$$
k_s^{\\text{eff}} = k_s (1 - d)
$$

这意味着损伤的累积会导致接触刚度的降低，宏观上表现为应力-应变曲线的软化段。

### 2.3 Law2_ScGeom_CpmPhys_Cpm 本构律

这是 Cpm 模型的核心本构律，定义了力-位移关系和损伤演化法则。

#### 2.3.1 力-位移关系

**法向方向**：
- 压缩 ($\\delta_n < 0$)：$F_n = k_n \\times \\delta_n$（弹性，无损伤）
- 拉伸 ($\\delta_n > 0$)：
  - 若 $\\delta_n < \\varepsilon_{\\text{crackOnset}} \\times L_{\\text{eff}}$：$F_n = k_n \\times \\delta_n$（弹性阶段）
  - 若 $\\delta_n > \\varepsilon_{\\text{crackOnset}} \\times L_{\\text{eff}}$：$F_n = k_n \\times (1 - d) \\times \\delta_n$（损伤阶段）

**切向方向**：
- 切向力满足 Mohr-Coulomb 屈服准则：
  $|F_t| \\leq \\mu \\times |F_n| + c \\times A_{\\text{eff}}$

#### 2.3.2 损伤演化法则

当法向应变超过 epsCrackOnset 时，损伤按以下规律演化：

$$
d = 1 - \\frac{\\varepsilon_{\\text{crackOnset}}}{\\varepsilon_N} \\exp\\!\\left(-\\frac{\\varepsilon_N - \\varepsilon_{\\text{crackOnset}}}{\\text{relDuctility} \\cdot \\varepsilon_{\\text{crackOnset}}}\\right)
$$

这是一个指数衰减形式：
- 当 $\\varepsilon_N \\to \\varepsilon_{\\text{crackOnset}}$ 时，$d \\to 0$（刚超过阈值，损伤很小）
- 当 $\\varepsilon_N \\to \\infty$ 时，$d \\to 1$（应变很大时，完全破坏）

\`relDuctility\` 控制了这个衰减的速度。较大的 relDuctility 使得衰减更慢，宏观上
表现为更缓的软化曲线。

### 2.4 损伤力学基础

#### 2.4.1 连续损伤力学 (CDM)

连续损伤力学最早由 Kachanov (1958) 提出，用于描述材料在荷载作用下的渐进劣化。
其核心思想是引入损伤变量 d 来描述材料的"健康程度"。

有效应力的概念：

$$
\\sigma_{\\text{eff}} = \\frac{\\sigma}{1 - d}
$$

应变等价原理：

$$
\\varepsilon = \\frac{\\sigma_{\\text{eff}}}{E_0} = \\frac{\\sigma}{E_0 (1 - d)} = \\frac{\\sigma}{E_d}
$$

其中 E_d = E₀ × (1 - d) 是损伤后的弹性模量。

#### 2.4.2 DEM 中的损伤

在 Cpm 模型中，损伤发生在**接触层面**（而非连续介质中的材料点层面）。每个接触
有自己独立的损伤变量，宏观的损伤效应是所有接触损伤的统计叠加。

这种微观-宏观的对应关系使得 Cpm 模型能够自然地模拟：
- 裂纹的萌生：局部接触的 d 从 0 开始增大
- 裂纹的扩展：损伤接触的聚集和连通
- 裂纹的贯通：形成连续的破坏面

### 2.5 拉压强度比

混凝土的一个关键特性是**拉压强度不对称**：

$$
f_t \\approx 2 \\sim 5 \\text{ MPa}, \\quad f_c \\approx 20 \\sim 60 \\text{ MPa}, \\quad \\frac{f_t}{f_c} \\approx \\frac{1}{10} \\sim \\frac{1}{15}
$$

在 Cpm 模型中，这种不对称性自然产生：

- **压缩时**：接触法向力为压力，颗粒间有摩擦力的贡献，且压缩使颗粒更紧密，
  承载力主要由刚度和摩擦决定
- **拉伸时**：接触法向力为拉力，仅靠粘结力 (sigmaT) 抵抗，一旦超过就进入损伤

### 2.6 CpmStateUpdater

\`CpmStateUpdater\` 是一个可选的引擎组件，用于在仿真过程中更新 Cpm 模型的状态
信息。它的主要功能：

- 更新每个接触的损伤状态
- 检测新增裂纹和已贯通的裂纹
- 更新颗粒级别的损伤状态（用于后处理着色等）

在简单的模拟中，CpmStateUpdater 不是必需的，因为 Law2_ScGeom_CpmPhys_Cpm 已经
在每个时间步中更新接触的损伤。但在以下情况下需要它：
- 需要在 GUI 中实时显示裂纹
- 需要 VTKRecorder 输出损伤场
- 需要统计裂纹数量和方位

### 2.7 UniaxialStrainer

\`UniaxialStrainer\` 是 YADE 中用于施加均匀单轴应变的引擎。它通过移动试样两端的
颗粒来实现拉伸或压缩。

#### 2.7.1 工作原理

UniaxialStrainer 将试样中所有颗粒按其在加载方向 (axis) 上的坐标排序，然后：
- **正端**：以速率 strainRate 向外移动
- **负端**：以速率 -strainRate 向外移动（或固定不动）
- **中间颗粒**：根据位置线性插值位移（保持均匀应变场）

#### 2.7.2 核心参数

| 参数 | 含义 | 说明 |
|------|------|------|
| \`axis\` | 加载方向 | 0=x, 1=y, 2=z |
| \`strainRate\` | 应变速率 [1/s] | 正值=拉伸，负值=压缩 |
| \`absInitialSize\` | 试样初始尺寸 [m] | 加载方向的长度 |
| \`posIds\` | 正端颗粒 ID 列表 | 被移动的"加载板"颗粒 |
| \`negIds\` | 负端颗粒 ID 列表 | 被移动的"加载板"颗粒 |
| \`blockDisplacements\` | 是否约束中间颗粒 | True = 均匀应变场 |
| \`blockRotations\` | 是否约束旋转 | True = 防止旋转 |

### 2.8 断裂模拟

#### 2.8.1 裂纹表示

在 Cpm 模型中，裂纹不是几何实体，而是通过**损伤接触**来表示：
- 一个完全破坏的接触 (d = 1) 就是一个"微裂纹"
- 多个相邻的完全破坏接触形成"宏观裂纹"
- 裂纹的方向由接触法向量确定

#### 2.8.2 裂纹类型

- **拉伸裂纹 (Mode I)**：法向拉力超过 sigmaT 时产生
- **剪切裂纹 (Mode II)**：切向力超过摩擦抗力时产生
- **混合裂纹 (Mixed Mode)**：同时受拉伸和剪切作用

#### 2.8.3 裂纹扩展机制

裂纹扩展是一个自组织过程：
1. 初始缺陷处的应力集中导致局部损伤
2. 损伤降低了局部刚度，将荷载转移到邻近接触
3. 邻近接触承受更大荷载，也开始损伤
4. 损伤区逐渐扩展形成裂纹
5. 裂纹贯通时，试样失去承载能力

这个过程不需要预设裂纹路径——裂纹路径完全由材料的非均匀性和荷载条件自然决定。

---

## 3. 代码逐行解析

### 3.1 材料参数

\`\`\`python
young = 30e9        # 杨氏模量 30 GPa（混凝土典型值）
poisson = 0.2       # 泊松比
frictionAngle = 0.6 # 摩擦角约 34°
density = 2500      # 混凝土密度
sigmaT = 3e6        # 拉伸强度 3 MPa
relDuctility = 0.1  # 相对延性（脆性）
epsCrackOnset = 1e-4 # 开裂应变阈值
\`\`\`

这些参数对应于典型的中等强度混凝土。实际应用中需要根据具体混凝土标号调整。

### 3.2 圆柱试样生成

\`\`\`python
sp = pack.randomDensePack(
    pack.inCylinder((...), radius, ...),
    ...
)
\`\`\`

\`pack.inCylinder()\` 定义了圆柱形区域，\`randomDensePack()\` 在该区域内生成致密
堆积。这是模拟圆柱试样的标准方法。

### 3.3 UniaxialStrainer 设置

UniaxialStrainer 需要识别试样两端的颗粒作为"加载板"：

\`\`\`python
# 识别 z 方向最大/最小坐标的颗粒作为加载端
for b in O.bodies:
    z = b.state.pos[2]
    if z < z_min + tol:
        negIds.append(b.id)
    elif z > z_max - tol:
        posIds.append(b.id)
\`\`\`

### 3.4 PyRunner 检测破坏

\`\`\`python
def checkFailure():
    # 获取当前应力
    ...
    # 如果应力下降到峰值的某个比例，认为试样破坏
    if stress < peakStress * 0.5:
        O.pause()
\`\`\`

### 3.5 数据采集与绘图

应力-应变曲线是混凝土力学试验最重要的输出。Cpm 模型能够完整地模拟从弹性阶段、
峰值强度到软化破坏的全过程。

---

## 4. 运行与观察

### 4.1 运行方法

\`\`\`bash
cd 07_concrete_mechanics
yadedaily concrete_mechanics.py
\`\`\`

### 4.2 预期结果

运行完成后，你将看到：

1. **应力-应变曲线**：
   - 线弹性上升段（斜率 = E）
   - 非线性段（接近峰值时）
   - 峰值应力（对应拉伸强度 ft）
   - 软化下降段（损伤演化）

2. **损伤演化曲线**：
   - d = 0（弹性阶段）
   - d 快速上升（接近峰值时）
   - d → 1（完全破坏）

3. **裂纹分布**（在 GUI 中）：
   - 可以看到拉伸裂纹在试样中部萌生
   - 裂纹大致垂直于加载方向扩展

### 4.3 物理解释

- **峰值前**：少数接触开始损伤，但整体仍能承载
- **峰值处**：损伤接触达到临界数量，形成第一个贯穿裂纹
- **峰值后**：裂纹面的接触大部分破坏，承载力迅速下降
- **残余强度**：压缩方向的摩擦力提供部分残余承载力

---

## 5. 练习题

### 练习 1：不同拉伸强度

修改 \`sigmaT\` 为 1e6、3e6、6e6，分别运行模拟。对比应力-应变曲线。

**思考题**：
- 峰值应力是否正比于 sigmaT？
- 高强度混凝土的软化段是否更陡峭？

### 练习 2：延性对比

修改 \`relDuctility\` 为 0.01（脆性）和 0.5（延性），对比软化行为。

**思考题**：
- 脆性材料的应力-应变曲线有何特征？
- 延性材料的能量耗散是否更大？（曲线下面积）

### 练习 3：单轴压缩

将 \`strainRate\` 改为负值（压缩），观察压缩应力-应变曲线。

**思考题**：
- 压缩强度是否远大于拉伸强度？
- 压缩曲线是否有明显的软化段？
- ft/fc 比值是否在合理范围内 (1/10 ~ 1/15)？

### 练习 4：裂纹可视化

启用 VTKRecorder，使用 ParaView 查看裂纹发展过程。

**提示**：可以将损伤值 d 映射为颜色，高损伤区域显示为红色，直观地观察裂纹路径。

---

## 6. 延伸阅读

- [YADE 宙方文档 — Cpm 模型](https://yade-dem.org/doc/yade.wrapper.html#yade.wrapper.CpmMat)
- Potapov, A.V. & Campbell, C.S. (1997). Computer simulation of hopper flow and fracture of glass beads. Powder Technology, 93(3), 249-262.
- Schlangen, E. & van Mier, J.G.M. (1992). Experimental and numerical analysis of micromechanisms of fracture of cement-based composites. Cement and Concrete Composites, 14(2), 105-118.
- Kachanov, L.M. (1958). Time of the rupture process under creep conditions. Isv. Akad. Nauk. SSR Otd. Tech. Nauk., 8, 26-31.
- Lemaitre, J. (1996). A Course on Damage Mechanics. Springer-Verlag.

---

**上一课**：[06 三轴试验](../06_triaxial_test/) —— 学习使用周期性边界模拟三轴试验。

**下一课**：[08 团簇与破碎](../08_clumps_breakage/) —— 学习非球形颗粒和颗粒破碎。`
    },
    8: {
      title: "团簇与破碎",
      level: "advanced",
      icon: "🔴",
      markdown: `# 08 团簇与破碎 —— 非球形颗粒与颗粒破碎

## 1. 项目简介

自然界中的颗粒材料很少是完美球形的。砾石、碎石、矿物颗粒等都呈现出不规则的形状。
使用球形颗粒来近似这些不规则形状，会导致以下问题：

- 旋转阻力不足：球体可以自由滚动，而真实颗粒由于形状不规则会相互"锁死"
- 抗剪强度偏低：形状不规则的颗粒之间更容易形成互锁结构
- 力链分布差异：非球形颗粒形成的力链网络与球形颗粒显著不同

在本项目中，我们将学习 YADE 中的 **Clump**（团簇）技术来创建非球形颗粒，以及
如何模拟颗粒的**破碎**行为。

通过本教程，你将掌握：
- Clump 的概念和创建方法
- 各种 Clump 形状的设计（哑铃形、L 形、三角形等）
- Clump 的惯性张量计算
- Clump 堆积的生成和压缩试验
- 颗粒破碎的模拟方法（Clump → 独立球体的替换）

---

## 2. 核心概念详解

### 2.1 Clump 概念

**Clump**（团簇）是 YADE 中的一种刚体，由多个**重叠**的球体组成。与普通球体
不同，Clump 中的球体之间没有接触——它们作为一个整体运动。

#### 2.1.1 Clump 与普通球体的区别

| 特性 | 单个球体 | Clump |
|------|----------|-------|
| 形状 | 完美球形 | 任意（由多个球组合） |
| 自由度 | 6 (3 平移 + 3 旋转) | 6 (3 平移 + 3 旋转) |
| 滚动阻力 | 无（需额外模型） | 天然具有（形状效应） |
| 碰撞检测 | 球-球接触 | 组成球体之间的接触 |
| 计算成本 | 低 | 较高 |
| 物理真实性 | 简单，适合快速计算 | 更接近真实颗粒 |

#### 2.1.2 Clump 的运动学

Clump 作为一个刚体运动，所有成员球体跟随整体的平移和旋转：

每个成员球体的位置：

$$r_i = R + Q \\times r_{\\text{local},i}$$

其中：
- $R$ = Clump 质心的全局位置
- $Q$ = Clump 的旋转四元数
- $r_{\\text{local},i}$ = 成员球体相对于质心的局部坐标（在 Clump 局部坐标系中）

Clump 的速度和角速度：
$$v_i = V + \\omega \\times (r_i - R)$$

其中 $V$ = 质心线速度，$\\omega$ = 角速度

### 2.2 创建 Clump

#### 2.2.1 使用 appendClumped()

\`O.bodies.appendClumped()\` 是创建 Clump 的基本方法。它接受一个列表，列表中
包含组成 Clump 的成员球体。

\`\`\`python
# 方法 1：直接用 appendClumped 创建
# 定义成员球体的位置和半径
# (位置, 半径) 的列表
members = [
    ([0, 0, -0.5], 0.5),    # 下球：中心在 (0,0,-0.5)，半径 0.5
    ([0, 0,  0.5], 0.5),    # 上球：中心在 (0,0, 0.5)，半径 0.5
]

# appendClumped 返回 Clump 的 body ID 和成员球体的 body ID
clumpId, memberIds = O.bodies.appendClumped([
    sphere(pos, radius) for pos, radius in members
])
\`\`\`

#### 2.2.2 Clump 模板

对于需要批量创建相同形状 Clump 的情况，可以使用 **Clump 模板**：

\`\`\`python
# 定义模板：(相对位置, 相对半径) 的列表
# 相对位置和半径是相对于"单位大小"的
template = [
    ([0, 0, -0.5], 0.5),    # 下球
    ([0, 0,  0.5], 0.5),    # 上球
]

# 使用模板在指定位置创建 Clump
# size 参数缩放模板的所有尺寸
clumpId = O.bodies.appendClumped([
    sphere(Vector3(pos) * size + center, radius * size)
    for pos, radius in template
])
\`\`\`

#### 2.2.3 常见 Clump 形状

**哑铃形 (Dumbbell)**：
\`\`\`python
# 两个球体沿一条轴线排列
dumbbell = [
    ([0, 0, -0.5], 0.5),   # 球 1
    ([0, 0,  0.5], 0.5),   # 球 2
]
\`\`\`

**L 形**：
\`\`\`python
# 两个球体呈直角排列
lShape = [
    ([0, 0, 0], 0.5),       # 角部
    ([1, 0, 0], 0.5),       # 水平臂
    ([0, 0, 1], 0.5),       # 垂直臂
]
\`\`\`

**三角形**：
\`\`\`python
# 三个球体呈等边三角形排列
import math
triangle = [
    ([0, 0, 0], 0.5),
    ([1, 0, 0], 0.5),
    ([0.5, math.sqrt(3)/2, 0], 0.5),
]
\`\`\`

**四面体**：
\`\`\`python
# 四个球体呈四面体排列
import math
tetra = [
    ([0, 0, 0], 0.5),
    ([1, 0, 0], 0.5),
    ([0.5, math.sqrt(3)/2, 0], 0.5),
    ([0.5, math.sqrt(3)/6, math.sqrt(6)/3], 0.5),
]
\`\`\`

### 2.3 惯性张量

#### 2.3.1 质量计算

Clump 的总质量是所有成员球体质量之和：

$$m = \\sum_i \\rho_i \\times \\frac{4}{3} \\cdot \\pi \\cdot r_i^3$$

#### 2.3.2 转动惯量计算

Clump 的转动惯量通过**平行轴定理**计算。对于每个成员球体，先计算其对自身中心的
惯性张量，然后平移到 Clump 的质心：

$$I_{\\text{clump}} = \\sum_i \\left[ I_i + m_i \\times (d_i^2 \\cdot E - d_i \\otimes d_i) \\right]$$

其中：
- I_i = (2/5) × m_i × r_i² × E 是球体的自身惯性张量
- d_i = r_i - R 是球体中心到 Clump 质心的向量
- E 是单位矩阵
- ⊗ 是外积

YADE 自动完成这个计算，用户不需要手动计算。

#### 2.3.3 惯性张量的物理意义

惯性张量描述了 Clump 对旋转的抵抗能力。对于非球形 Clump：
- 三个主惯性矩通常不相等
- 这导致 Clump 绕不同轴旋转的行为不同
- 这正是非球形颗粒"旋转阻力"的物理来源

### 2.4 非球形动力学

#### 2.4.1 旋转积分算法

YADE 提供了三种旋转积分算法：

| 算法 | 特点 | 适用场景 |
|------|------|----------|
| **Spiral** | 简单高效 | 一般用途 |
| **Omelyan** | 更精确的四元数积分 | 需要精确旋转的场景 |
| **Fincham** | 最优的精度/成本比 | 大多数 Clump 模拟 |

在 NewtonIntegrator 中设置：

\`\`\`python
NewtonIntegrator(
    rotIntegrator='Spiral',  # 或 'Omelyan', 'Fincham'
    ...
)
\`\`\`

#### 2.4.2 旋转阻尼

对于 Clump 模拟，可能需要额外的旋转阻尼来控制颗粒的旋转动能：

\`\`\`python
NewtonIntegrator(
    damping=0.2,              # 线性阻尼
    ...
)
\`\`\`

### 2.5 颗粒破碎

颗粒破碎是岩土工程和采矿业中的重要现象。在 DEM 中，有多种方法来模拟破碎：

#### 2.5.1 替换法 (Replacement Method)

最直观的方法：当 Clump 上的力超过阈值时，将 Clump 替换为多个独立的小球体。

**步骤**：
1. 监测每个 Clump 上的接触力
2. 当力超过强度阈值时，删除 Clump
3. 在相同位置创建独立的成员球体
4. 成员球体继承 Clump 的速度和角速度

**优点**：简单直接
**缺点**：破碎是突然的（非渐进的）

#### 2.5.2 粘结法 (Bonded Particle Model)

使用 Cpm 或类似的粘结模型将成员球体粘结在一起。当粘结力超过阈值时，粘结断裂，
Clump 自然"解体"。

**优点**：渐进破碎，更接近物理真实
**缺点**：计算成本更高，需要调更多参数

#### 2.5.3 破碎判据

常见的破碎判据包括：

- **力判据**：当 Clump 上的最大接触力超过 F_break
- **应力判据**：当 Clump 内部等效应力超过强度
- **能量判据**：当输入能量超过断裂能
- **概率判据**：力越大，破碎概率越高（统计方法）

### 2.6 Clump vs 球体的适用场景

| 场景 | 推荐 | 原因 |
|------|------|------|
| 快速原型验证 | 球体 | 计算快 |
| 堆积密度研究 | Clump | 形状影响大 |
| 旋转行为重要 | Clump | 天然旋转阻力 |
| 流变学研究 | Clump | 更接近真实 |
| 破碎模拟 | Clump | 必需 |
| 大规模模拟 | 球体 | 计算效率 |
| 管道流动 | 球体 | 接触检测简单 |

### 2.7 实际应用

Clump 技术在以下领域有广泛应用：

- **岩土工程**：模拟碎石、砾石、角砾等不规则骨料
- **采矿工程**：模拟矿石破碎过程
- **农业工程**：模拟谷物、种子等生物颗粒
- **制药工业**：模拟药片、颗粒剂
- **地质学**：模拟火山碎屑流、滑坡体

---

## 3. 代码逐行解析

### 3.1 Clump 形状定义

\`\`\`python
# 定义三种 Clump 形状模板
# 每个模板是一个 (相对位置, 相对半径) 的列表

# 哑铃形：两个球体沿 z 轴排列
dumbbellTemplate = [
    ([0, 0, -0.4], 0.5),
    ([0, 0,  0.4], 0.5),
]
\`\`\`

两个球体重叠部分越少，Clump 越"细长"；重叠越多，越接近球形。

### 3.2 Clump 生成与堆积

使用循环批量创建 Clump，并通过重力沉积形成堆积：

\`\`\`python
for i in range(numClumps):
    # 随机位置
    pos = Vector3(randomPos)
    # 随机选择模板
    template = random.choice(templates)
    # 随机缩放
    size = random.uniform(minSize, maxSize)
    # 创建 Clump
    ...
\`\`\`

### 3.3 破碎模拟

破碎的核心逻辑：

\`\`\`python
def checkBreakage():
    for b in O.bodies:
        if not isinstance(b.shape, Clump):
            continue
        # 计算 Clump 上的总力
        totalForce = O.forces.f(b.id).norm()
        # 与破碎阈值比较
        if totalForce > breakForce:
            replaceClumpWithSpheres(b)
\`\`\`

### 3.4 Clump 到独立球体的替换

\`\`\`python
def replaceClumpWithSpheres(clumpBody):
    # 获取 Clump 的位置、速度、角速度
    pos = clumpBody.state.pos
    vel = clumpBody.state.vel
    angVel = clumpBody.state.angVel
    ori = clumpBody.state.ori

    # 删除 Clump
    O.bodies.erase(clumpBody.id)

    # 创建独立的成员球体
    for localPos, radius in clumpMembers:
        # 将局部坐标转换为全局坐标
        globalPos = pos + ori * Vector3(localPos)
        # 计算成员球体的速度（线速度 + 旋转贡献）
        memberVel = vel + angVel.cross(Vector3(localPos))
        # 创建球体
        newId = O.bodies.append(sphere(globalPos, radius))
        O.bodies[newId].state.vel = memberVel
\`\`\`

---

## 4. 运行与观察

### 4.1 运行方法

\`\`\`bash
cd 08_clumps_breakage
yadedaily clumps_breakage.py
\`\`\`

### 4.2 预期结果

1. **Clump 生成阶段**：各种形状的 Clump 在空中下落
2. **沉积阶段**：Clump 堆积在容器底部，形成互锁结构
3. **压缩阶段**：顶部墙向下移动，Clump 受到压缩
4. **破碎阶段**：部分 Clump 在高力作用下破碎，释放出小球体

### 4.3 观察要点

- 非球形 Clump 的堆积孔隙率通常高于球形颗粒
- Clump 在压缩时表现出更强的抗剪强度（互锁效应）
- 破碎后，碎片（小球体）填充到空隙中，改变力链分布

---

## 5. 练习题

### 练习 1：不同 Clump 形状

设计 3 种以上不同的 Clump 形状（如十字形、星形、链式），分别生成堆积并对比
堆积密度。

### 练习 2：旋转行为观察

在倾斜平面上放置单个 Clump 和单个球体，观察它们的运动差异。Clump 是否表现出
更强的滚动阻力？

### 练习 3：破碎阈值研究

修改破碎力阈值，观察不同阈值下：
- 破碎发生的频率
- 最终颗粒级配的变化
- 力-位移曲线的差异

### 练习 4：Clump 模板系统

使用 Clump 模板（相对位置和相对半径）设计一套可以参数化生成不同形状的系统。
例如，通过调整球体间距参数来控制 Clump 的长宽比。

---

## 6. 延伸阅读

- [YADE 宙方文档 — Clump](https://yade-dem.org/doc/yade.wrapper.html#yade.wrapper.Clump)
- [YADE 宙方文档 — Clump 模板](https://yade-dem.org/doc/tutorial-clumps.html)
- Potapov, A.V. & Campbell, C.S. (1997). Computer simulation of hopper flow and fracture of glass beads. Powder Technology, 93(3), 249-262.
- Cho, G.C., Dodds, J. & Santamarina, J.C. (2006). Particle shape effects on packing density, stiffness, and strength: natural and crushed sands. J. Geotech. Geoenviron. Eng., 132(5), 591-602.
- Favier, J.F. et al. (1999). Industrial application of the DEM, from powder to granular materials. Chemical Engineering Science, 54(13-14), 1957-1964.

---

**上一课**：[07 混凝土力学](../07_concrete_mechanics/) —— 学习 Cpm 模型模拟混凝土。

**下一课**：[09 流固耦合](../09_fluid_coupling/) —— 学习 DEM 与流体的耦合模拟。`
    },
    9: {
      title: "流固耦合",
      level: "advanced",
      icon: "🔴",
      markdown: `# 09 流固耦合 —— DEM 颗粒与流体的相互作用

## 1. 项目简介

自然界和工程中，颗粒材料经常与流体（水、空气等）发生相互作用：

- **泥石流**：水与碎屑颗粒的混合流动
- **流化床**：气体向上通过颗粒床层，使颗粒悬浮
- **渗流**：地下水通过砂土层的流动
- **管道输送**：泥浆在管道中的输送
- **沙尘暴**：风吹起沙粒

这些现象的核心是**流固耦合** (Fluid-Solid Coupling) —— 流体对颗粒施加**阻力**
和**浮力**，而颗粒的存在反过来影响流体的流动。

在本项目中，我们将使用 YADE 的 **HydroForceEngine** 来模拟流体对 DEM 颗粒的
作用力，实现一个简化的**流化床** (Fluidized Bed) 模拟。

通过本教程，你将掌握：
- 流固耦合的基本概念和工程应用
- HydroForceEngine 的使用方法
- 阻力模型的物理基础（Stokes、Ergun、Di Felice）
- 浮力和渗透力的计算
- Kozeny-Carman 方程与渗透系数
- 流化现象的模拟和观察
- 无量纲数（雷诺数、斯托克斯数）的物理意义

---

## 2. 核心概念详解

### 2.1 流固耦合概念

#### 2.1.1 为什么需要流固耦合？

纯 DEM 模拟只考虑颗粒之间的接触力和重力。但在许多实际问题中，流体的作用不可
忽略：

- **渗流力**：地下水流动对土颗粒施加的拖曳力，可能导致管涌和流土
- **浮力**：浸没在流体中的颗粒受到阿基米德浮力
- **阻力**：颗粒在流体中运动时受到的流体阻力
- **附加质量效应**：颗粒加速时需要推动周围流体，等效质量增大

#### 2.1.2 耦合方式

流固耦合有多种实现方式，按耦合程度从弱到强：

| 耦合方式 | 描述 | YADE 实现 |
|----------|------|-----------|
| **单向耦合** | 流体影响颗粒，颗粒不影响流体 | HydroForceEngine（简单阻力） |
| **弱双向耦合** | 考虑颗粒对流体的平均影响 | HydroForceEngine + 平均孔隙率 |
| **强双向耦合** | 颗粒与流体完全相互作用 | FlowEngine (PFV) |
| **直接数值模拟** | 在颗粒表面解析流场 | LBM-DEM 耦合（外部工具） |

本教程使用 **HydroForceEngine**（单向/弱双向耦合），这是最简单也最常用的
方法。

### 2.2 HydroForceEngine

\`HydroForceEngine\` 是 YADE 中用于在颗粒上施加流体力的引擎。它计算并施加两种
流体力：**阻力** (drag force) 和 **浮力** (buoyancy force)。

#### 2.2.1 工作原理

在每个时间步中，HydroForceEngine 对每个颗粒：

1. 计算流体-颗粒的相对速度：v_rel = v_fluid - v_particle
2. 计算阻力：根据阻力模型和相对速度
3. 计算浮力：根据流体密度和颗粒体积
4. 将力施加到颗粒上

#### 2.2.2 核心参数

| 参数 | 含义 | 说明 |
|------|------|------|
| \`zVoid\` | 高度方向的孔隙率分布 | 一维数组，按高度分层 |
| \`vxFluid\` | x 方向流体速度分布 | 一维数组，按高度分层 |
| \`vyFluid\` | y 方向流体速度分布 | 一维数组 |
| \`vzFluid\` | z 方向流体速度分布 | 一维数组（竖向流速） |
| \`rhoFluid\` | 流体密度 [kg/m³] | 水：1000；空气：1.225 |
| \`dragLaw\` | 阻力模型 | 'Stokes', 'Newton', 'Ergun', 'DiFelice' |
| \`isPeriodic\` | 是否周期性边界 | True/False |

### 2.3 阻力模型

颗粒在流体中受到的阻力取决于流动状态（层流/湍流），不同的阻力模型适用于不同的
雷诺数范围。

#### 2.3.1 雷诺数 (Reynolds Number)

雷诺数是惯性力与粘性力之比，决定了流动状态：

$$Re = \\frac{\\rho_f \\times d_p \\times |v_{\\text{rel}}|}{\\mu}$$

其中：
- $\\rho_f$ = 流体密度
- $d_p$ = 颗粒直径
- $|v_{\\text{rel}}|$ = 流体-颗粒相对速度
- $\\mu$ = 流体动力粘度

| Re 范围 | 流动状态 | 适用阻力模型 |
|---------|----------|-------------|
| Re < 1 | 层流 (Stokes flow) | Stokes |
| 1 < Re < 1000 | 过渡区 | Schiller-Naumann |
| Re > 1000 | 湍流 (Newton regime) | Newton |
| 多颗粒系统 | 经验模型 | Ergun, Di Felice |

#### 2.3.2 Stokes 阻力

适用于极低雷诺数（Re < 1），即蠕动流：

$$F_{\\text{drag}} = 3 \\times \\pi \\times \\mu \\times d_p \\times v_{\\text{rel}} \\times f(\\varepsilon)$$

其中 $f(\\varepsilon)$ 是孔隙率修正函数（Richardson-Zaki 关系）：

$$f(\\varepsilon) = \\varepsilon^{-\\chi}, \\quad \\chi = 3.7 - 0.65 \\times \\exp\\left(-\\frac{(1.5 - \\log_{10}(Re))^2}{2}\\right)$$

对于 Stokes 流：$f(\\varepsilon) \\approx 1/\\varepsilon$（孔隙率越小，阻力越大）。

#### 2.3.3 Ergun 方程

Ergun (1952) 提出的阻力关系，适用于填充床中的流体流动：

$$\\frac{\\Delta p}{L} = 150 \\times \\mu \\times \\frac{(1-\\varepsilon)^2}{\\varepsilon^3 \\times d_p^2} \\times v + 1.75 \\times \\rho_f \\times \\frac{(1-\\varepsilon)}{\\varepsilon^3 \\times d_p} \\times v^2$$

上式包含两项：
- 第一项：粘性损失（低速时主导，正比于速度）
- 第二项：惯性损失（高速时主导，正比于速度的平方）

#### 2.3.4 Di Felice 修正

Di Felice (1994) 提出了更通用的阻力关系：

$$F_{\\text{drag}} = 0.5 \\times C_d \\times \\rho_f \\times \\frac{\\pi}{4} \\times d_p^2 \\times |v_{\\text{rel}}| \\times v_{\\text{rel}} \\times \\varepsilon^{-\\chi}$$

其中 $C_d$ 是单颗粒阻力系数：

$$C_d = \\left(0.63 + \\frac{4.8}{\\sqrt{Re}}\\right)^2 \\quad \\text{（适用于所有 Re 范围）}$$

孔隙率修正指数 χ：

$$\\chi = 3.7 - 0.65 \\times \\exp\\left(-\\frac{(1.5 - \\log_{10}(Re))^2}{2}\\right)$$

### 2.4 渗透系数

#### 2.4.1 Darcy 定律

在低速渗流中，流量与水力梯度成正比（Darcy, 1856）：

$$v = K \\times i = K \\times \\frac{\\Delta h}{L}$$

其中：
- $v$ = 渗透流速（表观速度）
- $K$ = 渗透系数 [m/s]
- $i$ = 水力梯度
- $\\Delta h$ = 水头损失
- $L$ = 渗流路径长度

#### 2.4.2 Kozeny-Carman 方程

渗透系数与颗粒材料孔隙率的关系由 Kozeny-Carman 方程给出：

$$K = \\frac{\\rho_f \\times g}{\\mu} \\times \\frac{\\varepsilon^3}{(1-\\varepsilon)^2} \\times \\frac{d_p^2}{180}$$

关键规律：
- $K$ 正比于 $d_p^2$（颗粒越大，渗透性越强）
- $K$ 随 $\\varepsilon$ 的增大而急剧增大（孔隙率增大，渗透性增强）
- $K$ 反比于 $(1-\\varepsilon)^2$

### 2.5 浮力

浸没在流体中的颗粒受到阿基米德浮力：

$$F_{\\text{buoyancy}} = -\\rho_f \\times V_p \\times g$$

其中：
- $V_p$ = 颗粒体积 = $(\\pi/6) \\times d_p^3$
- $g$ = 重力加速度（方向向下）
- 负号表示浮力方向向上

在多孔介质中，浮力的有效作用需要考虑孔隙率：

$$F_{\\text{buoyancy,eff}} = -\\rho_f \\times (1-\\varepsilon) \\times V_{\\text{cell}} \\times g / N_{\\text{particles}}$$

### 2.6 FlowEngine / PFV

YADE 还提供了更高级的流体求解器 —— **FlowEngine**，使用 **PFV (Pore Finite
Volume)** 方法求解孔隙空间中的 Stokes 方程。

#### 2.6.1 PFV 方法

PFV 方法的基本思想：
1. 对颗粒堆积进行 **Delaunay 三角剖分**
2. 每个四面体单元对应一个**孔隙体积**
3. 相邻孔隙之间的流动由**导管**（conduit）连接
4. 对每个孔隙建立质量守恒方程
5. 求解线性方程组得到孔隙压力场

#### 2.6.2 FlowEngine vs HydroForceEngine

| 特性 | HydroForceEngine | FlowEngine |
|------|-----------------|------------|
| 耦合程度 | 弱耦合 | 强耦合 |
| 流场计算 | 简化（均匀或一维） | 精确（三维孔隙流） |
| 计算成本 | 低 | 高 |
| 压力梯度 | 需手动设定 | 自动计算 |
| 适用场景 | 大规模简单问题 | 需要精确压力场的问题 |

**注意**：FlowEngine 需要额外编译 YADE 时启用，不一定在所有安装中可用。本教程
主要使用 HydroForceEngine，因为它更通用。

### 2.7 流体注入模拟

模拟流化床的关键是设定**向上**的流体速度：

\`\`\`python
# z 方向的流体速度（向上为正）
# 速度随高度分布（可以是均匀的或线性变化的）
nLayers = 20
vzFluid = [fluidVelocity] * nLayers  # 均匀分布
\`\`\`

当流体速度足够大时，阻力超过颗粒的有效重力（重力 - 浮力），颗粒被"流化"——
悬浮在流体中。

#### 2.7.1 最小流化速度

最小流化速度 (Minimum Fluidization Velocity) U_mf 是颗粒开始悬浮的临界流速：

对于 Ergun 方程，在最小流化条件下的力平衡：

$$\\Delta p \\times A = W_{\\text{effective}} = (\\rho_p - \\rho_f) \\times (1 - \\varepsilon_{mf}) \\times V_{\\text{bed}} \\times g$$

简化后得到：

$$U_{mf} \\approx \\frac{d_p^2 \\times (\\rho_p - \\rho_f) \\times g \\times \\varepsilon_{mf}^3}{180 \\times \\mu \\times (1 - \\varepsilon_{mf})}$$

### 2.8 无量纲数

#### 2.8.1 雷诺数 (Reynolds Number, Re)

$$Re = \\frac{\\rho_f \\times U \\times d_p}{\\mu}$$

- Re < 1：Stokes 流，粘性力主导
- Re > 1000：湍流，惯性力主导
- 流化床中通常 Re = 1~100

#### 2.8.2 斯托克斯数 (Stokes Number, Stk)

$$Stk = \\frac{\\rho_p \\times d_p^2 \\times U}{18 \\times \\mu \\times L}$$

- Stk << 1：颗粒跟随流体运动（如烟雾）
- Stk >> 1：颗粒惯性主导，不受流体影响（如沙尘暴中的大颗粒）

#### 2.8.3 阿基米德数 (Archimedes Number, Ar)

$$Ar = \\frac{\\rho_f \\times (\\rho_p - \\rho_f) \\times g \\times d_p^3}{\\mu^2}$$

- Ar 综合考虑了重力、浮力和粘性力
- 用于关联最小流化速度

---

## 3. 代码逐行解析

### 3.1 流体参数定义

\`\`\`python
fluidVelocity = 0.5     # 流体速度 [m/s]
rhoFluid = 1000         # 流体密度 [kg/m³]（水）
viscosity = 1e-3        # 流体粘度 [Pa·s]（水的动力粘度）
\`\`\`

水的动力粘度在 20°C 时约为 1.0 × 10⁻³ Pa·s。

### 3.2 管道/容器创建

使用 Box 创建一个无盖的矩形容器，底部封闭，四周封闭，顶部开放。

### 3.3 颗粒堆积

使用 \`makeCloud()\` 在容器底部区域生成球体颗粒：

\`\`\`python
sp.makeCloud(
    (margin, margin, 0),
    (containerWidth - margin, containerDepth - margin, bedHeight),
    ...
)
\`\`\`

### 3.4 HydroForceEngine 设置

\`\`\`python
HydroForceEngine(
    vzFluid=[fluidVelocity] * nLayers,  # z 方向流速
    rhoFluid=rhoFluid,                   # 流体密度
    ...
)
\`\`\`

### 3.5 流化状态监测

监测颗粒床的高度变化来判断是否发生流化：

\`\`\`python
def measureBedHeight():
    """测量颗粒床的平均高度"""
    heights = [b.state.pos[2] for b in O.bodies if isinstance(b.shape, Sphere)]
    return sum(heights) / len(heights) if heights else 0
\`\`\`

### 3.6 数据采集

记录以下数据：
- 颗粒床高度随时间的变化
- 颗粒平均动能
- 压力降（通过测量底部和顶部颗粒的竖向力）

---

## 4. 运行与观察

### 4.1 运行方法

\`\`\`bash
cd 09_fluid_coupling
yadedaily fluid_coupling.py
\`\`\`

### 4.2 预期结果

1. **低流速**：颗粒床保持静止，流体从颗粒间渗流
2. **临界流速**：颗粒开始松动，床面微微隆起
3. **流化状态**：颗粒悬浮，床面剧烈波动，类似沸腾
4. **高流速**：颗粒被吹出容器顶部（气力输送）

### 4.3 观察要点

- 流化前：颗粒床高度不变，配位数较高
- 流化后：颗粒床膨胀，配位数降低，颗粒剧烈运动
- 流化床的高度随流速的增大而增大

---

## 5. 练习题

### 练习 1：不同流速

修改 \`fluidVelocity\` 为 0.1、0.3、0.5、1.0 m/s，分别运行。观察：
- 低速时是否有颗粒运动？
- 临界流速大约是多少？
- 高速时颗粒是否被吹出？

### 练习 2：不同颗粒尺寸

修改 \`rMean\` 为不同值，观察颗粒尺寸对流化行为的影响。

**思考题**：
- 大颗粒还是小颗粒更容易流化？
- Kozeny-Carman 方程预测的趋势是否与模拟结果一致？

### 练习 3：不同流体密度

修改 \`rhoFluid\` 为 500（轻油）和 1200（盐水），观察浮力效应的变化。

**思考题**：
- 流体密度增大时，最小流化速度如何变化？
- 颗粒的有效重力 (重力 - 浮力) 如何变化？

### 练习 4：压力降分析

计算并绘制流化过程中的压力降 Δp 与流速 U 的关系图。

**提示**：在完全流化条件下，压力降应等于床层的单位面积有效重量：
$$\\Delta p = (\\rho_p - \\rho_f) \\times (1 - \\varepsilon) \\times H_{\\text{bed}} \\times g$$

---

## 6. 延伸阅读

- [YADE 官方文档 — HydroForceEngine](https://yade-dem.org/doc/yade.wrapper.html#yade.wrapper.HydroForceEngine)
- [YADE 官方文档 — FlowEngine](https://yade-dem.org/doc/yade.wrapper.html#yade.wrapper.FlowEngine)
- Ergun, S. (1952). Fluid flow through packed columns. Chemical Engineering Progress, 48(2), 89-94.
- Di Felice, R. (1994). The voidage function for fluid-particle interaction systems. Int. J. Multiphase Flow, 20(1), 153-159.
- Richardson, J.F. & Zaki, W.N. (1954). Sedimentation and fluidisation. Trans. Inst. Chem. Eng., 32, 35-53.
- Carman, P.C. (1937). Fluid flow through granular beds. Trans. Inst. Chem. Eng., 15, 150-166.
- Chareyre, B. et al. (2012). Fast and flexible fluid-solid coupling with YADE. Computers and Geotechnics, 45, 95-106.

---

**上一课**：[08 团簇与破碎](../08_clumps_breakage/) —— 学习非球形颗粒和颗粒破碎。

**回到首页**：[项目首页](../README.md) —— YADE DEM 学习之旅。`
    },
  };

  /* --------------------------------------------------------
     2. CHAPTER METADATA
     -------------------------------------------------------- */
  const CHAPTER_META = {
    1: { title: "弹跳球", level: "beginner", icon: "🟢" },
    2: { title: "重力沉降", level: "beginner", icon: "🟢" },
    3: { title: "一维压缩试验", level: "intermediate", icon: "🟡" },
    4: { title: "周期性简单剪切", level: "intermediate", icon: "🟡" },
    5: { title: "球体堆积技术", level: "intermediate", icon: "🟡" },
    6: { title: "三轴试验", level: "advanced", icon: "🔴" },
    7: { title: "混凝土力学", level: "advanced", icon: "🔴" },
    8: { title: "团簇与破碎", level: "advanced", icon: "🔴" },
    9: { title: "流固耦合", level: "advanced", icon: "🔴" }
  };

  /* --------------------------------------------------------
     3. STATE
     -------------------------------------------------------- */
  let currentChapter = null;
  let visitedChapters = JSON.parse(localStorage.getItem("yade_visited") || "{}");

  /* --------------------------------------------------------
     4. DOM REFERENCES
     -------------------------------------------------------- */
  const $content   = document.getElementById("content-wrapper");
  const $sidebar   = document.getElementById("sidebar");
  const $overlay   = document.getElementById("sidebar-overlay");
  const $hamburger = document.getElementById("hamburger-btn");
  const $themeBtn  = document.getElementById("theme-toggle");
  const $searchIn  = document.getElementById("search-input");
  const $searchRes = document.getElementById("search-results");
  const $progress  = document.getElementById("reading-progress");

  /* --------------------------------------------------------
     5. MARKED.JS CONFIGURATION
     -------------------------------------------------------- */
  if (typeof marked !== "undefined") {
    const renderer = new marked.Renderer();

    // Wrap code blocks with copy button
    renderer.code = function (code, language) {
      // Handle both old and new marked.js API
      let codeText, lang;
      if (typeof code === "object" && code !== null) {
        codeText = code.text || "";
        lang = code.lang || "";
      } else {
        codeText = code || "";
        lang = language || "";
      }
      const langClass = lang ? `language-${lang}` : "";
      const escaped = escapeHtml(codeText);
      return `<div class="code-block-wrapper"><pre class="line-numbers"><code class="${langClass}">${escaped}</code></pre><button class="code-copy-btn" onclick="App.copyCode(this)">复制</button></div>`;
    };

    marked.setOptions({
      renderer: renderer,
      gfm: true,
      breaks: false,
      pedantic: false
    });
  }

  /** Typeset math in a DOM element, retrying until MathJax is ready */
  function typesetMath(element) {
    if (typeof MathJax === 'undefined') return;
    function tryTypeset() {
      if (MathJax.typesetPromise) {
        MathJax.typesetPromise([element]).then(function () {
          scaleWideMath(element);
        }).catch(function () {
          setTimeout(tryTypeset, 200);
        });
      } else {
        setTimeout(tryTypeset, 200);
      }
    }
    tryTypeset();
  }

  /** Scale down wide MathJax display formulas to fit container width */
  function scaleWideMath(container) {
    container.querySelectorAll('.math-display mjx-container[display="true"]').forEach(function (el) {
      var parent = el.parentElement;
      if (!parent) return;
      var maxW = parent.clientWidth;
      var w = el.scrollWidth;
      if (w > maxW) {
        var ratio = maxW / w;
        var wrapper = document.createElement('div');
        wrapper.style.overflow = 'hidden';
        wrapper.style.maxWidth = '100%';
        wrapper.style.margin = '1em 0';
        el.parentNode.insertBefore(wrapper, el);
        wrapper.appendChild(el);
        el.style.transform = 'scale(' + ratio + ')';
        el.style.transformOrigin = 'top center';
        el.style.width = (100 / ratio) + '%';
        el.style.margin = '0';
        wrapper.style.height = (el.offsetHeight * ratio) + 'px';
      }
    });
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* --------------------------------------------------------
     6. RENDERING
     -------------------------------------------------------- */

  /** Render a chapter's markdown into the content area */
  function renderChapter(chapterId) {
    const chapter = CHAPTERS[chapterId];
    if (!chapter) {
      renderWelcome();
      return;
    }

    currentChapter = chapterId;

    // Mark as visited
    visitedChapters[chapterId] = true;
    localStorage.setItem("yade_visited", JSON.stringify(visitedChapters));
    updateNavStatus();

    // Update active nav item
    document.querySelectorAll(".nav-item").forEach(function (li) {
      li.classList.toggle("active", parseInt(li.dataset.chapter) === chapterId);
    });

    // Render markdown
    // Protect LaTeX \\ (line break = 2 backslashes) from being consumed by marked.js
    // Use split/join for exact match — regex /\\\\/g matches single \ too
    var PH = '\x00LTX\x00';
    var PHU = '\x00LTXU\x00';
    var safeMd = chapter.markdown.split('\\\\').join(PH);

    // Protect underscores inside $$...$$ blocks from being treated as emphasis by marked.js
    // Find $$...$$ blocks and replace _ with placeholder
    safeMd = safeMd.replace(/\$\$([\s\S]*?)\$\$/g, function (m, inner) {
      return '$$' + inner.replace(/_/g, PHU) + '$$';
    });

    var html = marked.parse(safeMd);
    html = html.split(PH).join('\\\\');

    // Restore underscores inside math blocks (now in HTML as $$...$$ or <div>$$...$$</div>)
    html = html.replace(/\$\$([\s\S]*?)\$\$/g, function (m, inner) {
      return '$$' + inner.split(PHU).join('_') + '$$';
    });

    // Protect display math ($$...$$) from being wrapped in <p> by marked.js
    // MathJax's default pattern requires $$ at line-start, which fails inside <p>
    html = html.replace(/<p>\s*\$\$([\s\S]*?)\$\$\s*<\/p>/g, function (m, inner) {
      return '<div class="math-display">$$' + inner + '$$</div>';
    });

    $content.innerHTML = '<div class="md-content">' + html + '</div>';

    // Post-render: highlight code, add collapsible sections
    highlightCode();
    makeHeadersCollapsible();
    addBackToTop();

    // Render math formulas with MathJax
    typesetMath($content);

    // Scroll to top
    document.getElementById("main-content").scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Close mobile sidebar
    closeSidebar();
  }

  /** Render the welcome page */
  function renderWelcome() {
    currentChapter = null;
    document.querySelectorAll(".nav-item").forEach(function (li) {
      li.classList.remove("active");
    });

    $content.innerHTML = buildWelcomeHTML();
    highlightCode();
    closeSidebar();

    // Render math formulas on welcome page
    typesetMath($content);
  }

  function buildWelcomeHTML() {
    return `
    <div class="welcome-page">
      <h1>YADE DEM 学习教程</h1>
      <p class="welcome-subtitle">从零开始，系统学习离散元方法与YADE模拟</p>

      <!-- Learning Roadmap -->
      <div class="roadmap">
        <div class="roadmap-level">
          <div class="roadmap-level-icon">🟢</div>
          <div class="roadmap-level-title">入门基础</div>
          <ul class="roadmap-level-items">
            <li onclick="App.goTo(1)">1. 弹跳球</li>
            <li onclick="App.goTo(2)">2. 重力沉降</li>
          </ul>
        </div>
        <div class="roadmap-arrow">➜</div>
        <div class="roadmap-level">
          <div class="roadmap-level-icon">🟡</div>
          <div class="roadmap-level-title">进阶技能</div>
          <ul class="roadmap-level-items">
            <li onclick="App.goTo(3)">3. 一维压缩试验</li>
            <li onclick="App.goTo(4)">4. 周期性简单剪切</li>
            <li onclick="App.goTo(5)">5. 球体堆积技术</li>
          </ul>
        </div>
        <div class="roadmap-arrow">➜</div>
        <div class="roadmap-level">
          <div class="roadmap-level-icon">🔴</div>
          <div class="roadmap-level-title">高级应用</div>
          <ul class="roadmap-level-items">
            <li onclick="App.goTo(6)">6. 三轴试验</li>
            <li onclick="App.goTo(7)">7. 混凝土力学</li>
            <li onclick="App.goTo(8)">8. 团簇与破碎</li>
            <li onclick="App.goTo(9)">9. 流固耦合</li>
          </ul>
        </div>
      </div>

      <!-- DEM Concept Visualizations -->
      <div class="demo-visualizations">
        <h2>核心概念可视化</h2>
        <div class="demo-vis-grid">
          <div class="demo-vis-card" onclick="App.showAnimation('collision')">
            <svg viewBox="0 0 200 120" width="200" height="120">
              <rect x="10" y="10" width="60" height="60" fill="none" stroke="#e94560" stroke-width="1" stroke-dasharray="4" rx="2"/>
              <rect x="130" y="10" width="60" height="60" fill="none" stroke="#e94560" stroke-width="1" stroke-dasharray="4" rx="2"/>
              <circle cx="50" cy="40" r="25" fill="#0f3460" opacity="0.7"/>
              <circle cx="150" cy="40" r="25" fill="#0f3460" opacity="0.7"/>
              <line x1="75" y1="40" x2="125" y2="40" stroke="#e94560" stroke-width="2"/>
              <text x="100" y="100" text-anchor="middle" fill="#e94560" font-size="11">AABB + 接触</text>
            </svg>
            <h3>碰撞检测</h3>
            <p>AABB包围盒与接触检测</p>
          </div>
          <div class="demo-vis-card" onclick="App.showAnimation('forcechain')">
            <svg viewBox="0 0 200 120" width="200" height="120">
              <circle cx="50" cy="30" r="15" fill="#0f3460" opacity="0.7"/>
              <circle cx="100" cy="50" r="12" fill="#0f3460" opacity="0.7"/>
              <circle cx="150" cy="35" r="14" fill="#0f3460" opacity="0.7"/>
              <circle cx="75" cy="80" r="13" fill="#0f3460" opacity="0.7"/>
              <circle cx="130" cy="85" r="11" fill="#0f3460" opacity="0.7"/>
              <line x1="50" y1="30" x2="100" y2="50" stroke="#e94560" stroke-width="4"/>
              <line x1="100" y1="50" x2="150" y2="35" stroke="#e94560" stroke-width="3"/>
              <line x1="100" y1="50" x2="75" y2="80" stroke="#e94560" stroke-width="2"/>
              <line x1="100" y1="50" x2="130" y2="85" stroke="#e94560" stroke-width="1"/>
              <text x="100" y="110" text-anchor="middle" fill="#e94560" font-size="11">力链网络</text>
            </svg>
            <h3>力链</h3>
            <p>力的传递路径与强度</p>
          </div>
          <div class="demo-vis-card" onclick="App.showAnimation('shear')">
            <svg viewBox="0 0 200 120" width="200" height="120">
              <g opacity="0.7">
                <circle cx="40" cy="25" r="10" fill="#0f3460"/>
                <circle cx="70" cy="25" r="10" fill="#0f3460"/>
                <circle cx="100" cy="25" r="10" fill="#0f3460"/>
                <circle cx="130" cy="25" r="10" fill="#0f3460"/>
                <circle cx="160" cy="25" r="10" fill="#0f3460"/>
                <circle cx="55" cy="55" r="10" fill="#0f3460"/>
                <circle cx="85" cy="55" r="10" fill="#0f3460"/>
                <circle cx="115" cy="55" r="10" fill="#0f3460"/>
                <circle cx="145" cy="55" r="10" fill="#0f3460"/>
              </g>
              <!-- Sheared row -->
              <g opacity="0.7" transform="translate(15, 0)">
                <circle cx="40" cy="85" r="10" fill="#e94560"/>
                <circle cx="70" cy="85" r="10" fill="#e94560"/>
                <circle cx="100" cy="85" r="10" fill="#e94560"/>
                <circle cx="130" cy="85" r="10" fill="#e94560"/>
                <circle cx="160" cy="85" r="10" fill="#e94560"/>
              </g>
              <text x="100" y="112" text-anchor="middle" fill="#e94560" font-size="11">剪切变形</text>
            </svg>
            <h3>剪切变形</h3>
            <p>颗粒体系的剪切响应</p>
          </div>
        </div>
      </div>

      <!-- Quick Start -->
      <div class="welcome-section">
        <h2>快速开始</h2>
        <p>建议按照以下步骤开始学习：</p>
        <ul>
          <li>确保已安装 YADE（推荐最新版本）</li>
          <li>从左侧导航选择第一个教程 <strong>弹跳球</strong></li>
          <li>复制代码到本地 <code>script.py</code> 文件</li>
          <li>在终端运行 <code>yade script.py</code></li>
          <li>使用 <code>yade.qt.View()</code> 查看三维可视化</li>
        </ul>
      </div>

      <!-- Tips -->
      <div class="welcome-section">
        <h2>学习建议</h2>
        <ul>
          <li><strong>动手实践</strong>：每个示例都请亲自运行并修改参数</li>
          <li><strong>理解物理</strong>：DEM的参数都有明确的物理意义，不要随意设置</li>
          <li><strong>善用文档</strong>：<code>help()</code> 和 YADE 官方文档是最好的参考</li>
          <li><strong>逐步深入</strong>：掌握基础后再进入下一阶段</li>
        </ul>
      </div>
    </div>`;
  }

  /* --------------------------------------------------------
     7. POST-RENDER FEATURES
     -------------------------------------------------------- */

  /** Apply Prism.js syntax highlighting to all code blocks */
  function highlightCode() {
    if (typeof Prism !== "undefined") {
      $content.querySelectorAll('pre code[class*="language-"]').forEach(function (el) {
        Prism.highlightElement(el);
      });
    }
  }

  /** Make h2/h3 headers collapsible */
  function makeHeadersCollapsible() {
    var mdEl = $content.querySelector(".md-content");
    if (!mdEl) return;

    var headers = mdEl.querySelectorAll("h2, h3");
    headers.forEach(function (header) {
      header.addEventListener("click", function () {
        var collapsed = header.classList.toggle("collapsed");
        // Collect all sibling elements until next header of same or higher level
        var level = parseInt(header.tagName.charAt(1));
        var sibling = header.nextElementSibling;
        while (sibling) {
          var sibTag = sibling.tagName;
          if (sibTag && sibTag.match(/^H[1-6]$/)) {
            var sibLevel = parseInt(sibTag.charAt(1));
            if (sibLevel <= level) break;
          }
          if (collapsed) {
            sibling.classList.add("collapsed");
          } else {
            sibling.classList.remove("collapsed");
          }
          sibling = sibling.nextElementSibling;
        }
      });
    });
  }

  /** Add "back to top" link at end of content */
  function addBackToTop() {
    var mdEl = $content.querySelector(".md-content");
    if (!mdEl) return;
    var btn = document.createElement("button");
    btn.className = "back-to-top";
    btn.textContent = "↑ 回到顶部";
    btn.onclick = function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    mdEl.appendChild(btn);
  }

  /* --------------------------------------------------------
     8. NAVIGATION
     -------------------------------------------------------- */

  /** Handle hash-based routing */
  function handleRoute() {
    var hash = window.location.hash;
    if (hash && hash.match(/^#chapter-\d+$/)) {
      var id = parseInt(hash.replace("#chapter-", ""));
      renderChapter(id);
    } else {
      renderWelcome();
    }
  }

  /** Navigate to a chapter */
  function goTo(chapterId) {
    window.location.hash = "#chapter-" + chapterId;
  }

  /** Update nav status icons (checkmarks for visited) */
  function updateNavStatus() {
    document.querySelectorAll(".nav-item").forEach(function (li) {
      var id = parseInt(li.dataset.chapter);
      var statusEl = li.querySelector(".nav-item-status");
      if (statusEl) {
        statusEl.textContent = visitedChapters[id] ? "\u2705" : "";
      }
    });
  }

  /** Toggle nav group collapse */
  function toggleNavGroup(level) {
    var list = document.querySelector('.nav-group-list[data-group="' + level + '"]');
    if (!list) return;
    var chevron = list.previousElementSibling.querySelector(".nav-chevron");
    list.classList.toggle("collapsed");
    if (chevron) chevron.classList.toggle("collapsed");
  }

  /* --------------------------------------------------------
     9. DARK / LIGHT MODE
     -------------------------------------------------------- */

  function initTheme() {
    var saved = localStorage.getItem("yade_theme");
    if (saved === "light") {
      document.body.classList.remove("dark-mode");
      document.body.classList.add("light-mode");
      $themeBtn.querySelector(".theme-icon").textContent = "☀️";
      swapPrismTheme(true);
    }
  }

  function toggleTheme() {
    var isLight = document.body.classList.toggle("light-mode");
    document.body.classList.toggle("dark-mode", !isLight);
    $themeBtn.querySelector(".theme-icon").textContent = isLight ? "☀️" : "🌙";
    localStorage.setItem("yade_theme", isLight ? "light" : "dark");
    swapPrismTheme(isLight);
  }

  function swapPrismTheme(isLight) {
    var link = document.querySelector('link[href*="prism"]');
    if (link) {
      link.href = isLight
        ? "https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism.min.css"
        : "https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css";
    }
  }

  /* --------------------------------------------------------
     10. SEARCH
     -------------------------------------------------------- */

  function initSearch() {
    $searchIn.addEventListener("input", function () {
      var q = $searchIn.value.trim().toLowerCase();
      if (q.length < 2) {
        $searchRes.classList.remove("visible");
        $searchRes.innerHTML = "";
        return;
      }
      var results = [];
      for (var id = 1; id <= 9; id++) {
        var ch = CHAPTERS[id];
        if (!ch) continue;
        var meta = CHAPTER_META[id];
        var titleMatch = meta.title.toLowerCase().indexOf(q) >= 0;
        var contentMatch = ch.markdown.toLowerCase().indexOf(q) >= 0;
        if (titleMatch || contentMatch) {
          var context = "";
          if (contentMatch) {
            var idx = ch.markdown.toLowerCase().indexOf(q);
            var start = Math.max(0, idx - 30);
            var end = Math.min(ch.markdown.length, idx + q.length + 30);
            context = "..." + ch.markdown.substring(start, end).replace(/\n/g, " ") + "...";
          }
          results.push({ id: id, title: meta.icon + " " + meta.title, context: context });
        }
      }
      if (results.length === 0) {
        $searchRes.innerHTML = '<div class="search-result-item">无匹配结果</div>';
      } else {
        $searchRes.innerHTML = results.map(function (r) {
          return '<div class="search-result-item" onclick="App.goTo(' + r.id + ')">' +
            '<div>' + r.title + '</div>' +
            (r.context ? '<div class="match-context">' + highlightMatch(r.context, q) + '</div>' : '') +
            '</div>';
        }).join("");
      }
      $searchRes.classList.add("visible");
    });

    // Close search results when clicking outside
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".sidebar-search")) {
        $searchRes.classList.remove("visible");
      }
    });
  }

  function highlightMatch(text, query) {
    var idx = text.toLowerCase().indexOf(query);
    if (idx < 0) return escapeHtml(text);
    var before = escapeHtml(text.substring(0, idx));
    var match = escapeHtml(text.substring(idx, idx + query.length));
    var after = escapeHtml(text.substring(idx + query.length));
    return before + '<span class="search-highlight">' + match + '</span>' + after;
  }

  /* --------------------------------------------------------
     11. READING PROGRESS
     -------------------------------------------------------- */

  function updateProgress() {
    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    var docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    $progress.style.width = Math.min(pct, 100) + "%";
  }

  /* --------------------------------------------------------
     12. MOBILE SIDEBAR
     -------------------------------------------------------- */

  function openSidebar() {
    $sidebar.classList.add("open");
    $overlay.classList.add("visible");
    $hamburger.classList.add("active");
  }

  function closeSidebar() {
    $sidebar.classList.remove("open");
    $overlay.classList.remove("visible");
    $hamburger.classList.remove("active");
  }

  function toggleSidebar() {
    if ($sidebar.classList.contains("open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  /* --------------------------------------------------------
     13. SVG ANIMATIONS
     -------------------------------------------------------- */

  var SVG_ANIMATIONS = {
    collision: function () {
      return {
        title: "碰撞检测演示",
        desc: "DEM使用两步碰撞检测：宽相（AABB包围盒快速筛选）和窄相（精确几何计算接触重叠量）",
        svg: `
<svg viewBox="0 0 460 260" width="460" height="260" style="background:var(--bg-primary);border-radius:8px;">
  <style>
    .c1 { fill: #0f3460; opacity: 0.8; }
    .c2 { fill: #e94560; opacity: 0.5; stroke: #e94560; stroke-width: 1.5; stroke-dasharray: 5 3; fill-opacity: 0.15; }
    .ball { fill: #4fc3f7; }
    .ball2 { fill: #ff8a65; }
    .arrow { fill: none; stroke: #aaa; stroke-width: 1.5; marker-end: url(#arr); }
    .label { fill: var(--text-primary, #e0e0e0); font-size: 12px; font-family: sans-serif; }
    .small { font-size: 10px; fill: #888; }
    @keyframes moveLeft { from { transform: translateX(80px); } to { transform: translateX(0px); } }
    @keyframes moveRight { from { transform: translateX(-80px); } to { transform: translateX(0px); } }
    @keyframes overlapFlash { 0%,100% { opacity: 0.05; } 50% { opacity: 0.3; } }
    .animL { animation: moveLeft 2.5s ease-in-out infinite alternate; }
    .animR { animation: moveRight 2.5s ease-in-out infinite alternate; }
    .flash { animation: overlapFlash 2.5s ease-in-out infinite alternate; }
  </style>
  <defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#aaa"/></marker></defs>

  <!-- Phase labels -->
  <text x="115" y="20" text-anchor="middle" class="label">宽相检测 (AABB)</text>
  <text x="345" y="20" text-anchor="middle" class="label">窄相检测 (几何)</text>

  <!-- Left: AABB boxes -->
  <rect class="c2 animL" x="40" y="45" width="70" height="70" rx="3"/>
  <rect class="c2 animR" x="170" y="45" width="70" height="70" rx="3"/>
  <circle class="ball animL" cx="75" cy="80" r="28"/>
  <circle class="ball2 animR" cx="205" cy="80" r="28"/>
  <text x="75" y="140" text-anchor="middle" class="small">Ball A</text>
  <text x="205" y="140" text-anchor="middle" class="small">Ball B</text>

  <!-- Arrow between -->
  <line class="arrow" x1="130" y1="80" x2="155" y2="80"/>

  <!-- Right: Actual contact -->
  <circle class="ball" cx="300" cy="80" r="28"/>
  <circle class="ball2" cx="350" cy="80" r="28"/>
  <!-- Overlap zone -->
  <ellipse class="flash" cx="325" cy="80" rx="18" ry="25" fill="#e94560" opacity="0.2"/>
  <!-- Contact normal -->
  <line x1="325" y1="80" x2="325" y2="40" stroke="#4caf50" stroke-width="2" marker-end="url(#arr)"/>
  <text x="325" y="35" text-anchor="middle" class="small" fill="#4caf50">法向 n</text>
  <text x="325" y="140" text-anchor="middle" class="small">重叠量 δ</text>
  <line x1="300" y1="120" x2="350" y2="120" stroke="#e94560" stroke-width="1" stroke-dasharray="3"/>
  <text x="325" y="133" text-anchor="middle" class="small" fill="#e94560">← δ →</text>

  <!-- Explanation -->
  <text x="230" y="190" text-anchor="middle" class="label">步骤1: AABB重叠 → 候选接触对</text>
  <text x="230" y="210" text-anchor="middle" class="label">步骤2: 几何计算 → 确认接触，计算重叠量</text>
  <text x="230" y="240" text-anchor="middle" class="small">AABB = 轴对齐包围盒(Axis-Aligned Bounding Box)</text>
</svg>`
      };
    },

    forcechain: function () {
      return {
        title: "力链网络演示",
        desc: "在颗粒体系中，接触力通过力链传递。力链越粗表示力越大，形成了不均匀的力网络结构。",
        svg: `
<svg viewBox="0 0 460 300" width="460" height="300" style="background:var(--bg-primary);border-radius:8px;">
  <style>
    .fc-ball { fill: #4fc3f7; stroke: #2196f3; stroke-width: 1; }
    .fc-wall { fill: #555; }
    @keyframes pulse-thick { 0%,100% { opacity:0.8; } 50% { opacity:1; stroke-width:7; } }
    @keyframes pulse-thin { 0%,100% { opacity:0.5; } 50% { opacity:0.7; stroke-width:2; } }
    .fc-thick { stroke: #e94560; fill: none; animation: pulse-thick 2s ease-in-out infinite; }
    .fc-medium { stroke: #ff9800; fill: none; stroke-width: 4; opacity: 0.7; }
    .fc-thin { stroke: #66bb6a; fill: none; animation: pulse-thin 2.5s ease-in-out infinite; }
    .fc-label { fill: var(--text-primary, #e0e0e0); font-size: 11px; font-family: sans-serif; }
    .fc-small { font-size: 9px; fill: #888; font-family: sans-serif; }
  </style>

  <!-- Bottom wall -->
  <rect class="fc-wall" x="60" y="250" width="340" height="10" rx="3"/>
  <!-- Top load arrow -->
  <line x1="230" y1="20" x2="230" y2="60" stroke="#e94560" stroke-width="3"/>
  <polygon points="222,60 238,60 230,72" fill="#e94560"/>
  <text x="230" y="15" text-anchor="middle" class="fc-label">σ</text>

  <!-- Layer 1 (bottom) -->
  <circle class="fc-ball" cx="120" cy="225" r="22"/>
  <circle class="fc-ball" cx="180" cy="228" r="20"/>
  <circle class="fc-ball" cx="240" cy="225" r="22"/>
  <circle class="fc-ball" cx="300" cy="228" r="20"/>
  <circle class="fc-ball" cx="355" cy="225" r="18"/>

  <!-- Layer 2 -->
  <circle class="fc-ball" cx="148" cy="178" r="19"/>
  <circle class="fc-ball" cx="210" cy="175" r="21"/>
  <circle class="fc-ball" cx="272" cy="178" r="19"/>
  <circle class="fc-ball" cx="330" cy="180" r="17"/>

  <!-- Layer 3 -->
  <circle class="fc-ball" cx="178" cy="130" r="20"/>
  <circle class="fc-ball" cx="240" cy="125" r="22"/>
  <circle class="fc-ball" cx="300" cy="132" r="18"/>

  <!-- Layer 4 (top) -->
  <circle class="fc-ball" cx="208" cy="82" r="18"/>
  <circle class="fc-ball" cx="268" cy="85" r="16"/>

  <!-- Strong force chains (thick) -->
  <line class="fc-thick" x1="230" y1="68" x2="208" y2="82" stroke-width="6"/>
  <line class="fc-thick" x1="230" y1="68" x2="268" y2="85" stroke-width="6"/>
  <line class="fc-thick" x1="208" y1="82" x2="210" y2="175" stroke-width="6"/>
  <line class="fc-thick" x1="268" y1="85" x2="272" y2="178" stroke-width="6"/>
  <line class="fc-thick" x1="210" y1="175" x2="240" y2="225" stroke-width="6"/>
  <line class="fc-thick" x1="272" y1="178" x2="300" y2="228" stroke-width="5"/>

  <!-- Medium force chains -->
  <line class="fc-medium" x1="208" y1="82" x2="178" y2="130"/>
  <line class="fc-medium" x1="178" y1="130" x2="148" y2="178"/>
  <line class="fc-medium" x1="148" y1="178" x2="180" y2="228"/>
  <line class="fc-medium" x1="272" y1="178" x2="330" y2="180"/>
  <line class="fc-medium" x1="330" y1="180" x2="355" y2="225"/>

  <!-- Weak contacts (thin) -->
  <line class="fc-thin" x1="120" y1="225" x2="180" y2="228" stroke-width="1.5"/>
  <line class="fc-thin" x1="240" y1="225" x2="300" y2="228" stroke-width="1.5"/>
  <line class="fc-thin" x1="148" y1="178" x2="210" y2="175" stroke-width="1.5"/>
  <line class="fc-thin" x1="240" y1="225" x2="210" y2="175" stroke-width="1.5"/>

  <!-- Legend -->
  <text x="30" y="40" class="fc-label">力链强度:</text>
  <line x1="30" y1="55" x2="70" y2="55" stroke="#e94560" stroke-width="6"/>
  <text x="75" y="59" class="fc-small">强</text>
  <line x1="30" y1="72" x2="70" y2="72" stroke="#ff9800" stroke-width="4"/>
  <text x="75" y="76" class="fc-small">中</text>
  <line x1="30" y1="89" x2="70" y2="89" stroke="#66bb6a" stroke-width="2"/>
  <text x="75" y="93" class="fc-small">弱</text>

  <!-- Annotation -->
  <text x="230" y="285" text-anchor="middle" class="fc-label">力链宽度 ∝ 接触力大小 | 力链形成不均匀网络结构</text>
</svg>`
      };
    },

    shear: function () {
      return {
        title: "剪切变形演示",
        desc: "颗粒体系在剪切力作用下发生变形，上层颗粒相对下层移动，导致体积膨胀（剪胀效应）。",
        svg: `
<svg viewBox="0 0 460 300" width="460" height="300" style="background:var(--bg-primary);border-radius:8px;">
  <style>
    .sh-ball { fill: #4fc3f7; stroke: #2196f3; stroke-width: 1; }
    .sh-wall { fill: #555; }
    .sh-label { fill: var(--text-primary, #e0e0e0); font-size: 11px; font-family: sans-serif; }
    .sh-small { font-size: 9px; fill: #888; font-family: sans-serif; }
    @keyframes shearTop {
      0% { transform: translateX(0px); }
      100% { transform: translateX(35px); }
    }
    @keyframes shearBot {
      0% { transform: translateX(0px); }
      100% { transform: translateX(-35px); }
    }
    .sh-top { animation: shearTop 3s ease-in-out infinite alternate; }
    .sh-bot { animation: shearBot 3s ease-in-out infinite alternate; }
  </style>

  <!-- Shear direction arrows -->
  <text x="230" y="18" text-anchor="middle" class="sh-label">剪切方向</text>
  <line x1="160" y1="30" x2="300" y2="30" stroke="#e94560" stroke-width="2" marker-end="url(#arr)"/>
  <line x1="300" y1="280" x2="160" y2="280" stroke="#e94560" stroke-width="2"/>
  <polygon points="168,275 160,280 168,285" fill="#e94560"/>

  <!-- Top wall -->
  <rect class="sh-wall sh-top" x="80" y="35" width="300" height="8" rx="3"/>

  <!-- Top layer (moving right) -->
  <g class="sh-top">
    <circle class="sh-ball" cx="130" cy="70" r="18"/>
    <circle class="sh-ball" cx="185" cy="68" r="20"/>
    <circle class="sh-ball" cx="240" cy="70" r="18"/>
    <circle class="sh-ball" cx="295" cy="68" r="20"/>
    <circle class="sh-ball" cx="345" cy="70" r="16"/>
  </g>

  <!-- Middle layer (sheared) -->
  <g>
    <circle class="sh-ball" cx="155" cy="120" r="19" opacity="0.9"/>
    <circle class="sh-ball" cx="210" cy="118" r="21" opacity="0.9"/>
    <circle class="sh-ball" cx="268" cy="120" r="19" opacity="0.9"/>
    <circle class="sh-ball" cx="320" cy="122" r="17" opacity="0.9"/>
  </g>

  <!-- Shear band highlight -->
  <rect x="100" y="95" width="260" height="50" fill="#e94560" opacity="0.08" rx="5"/>
  <text x="380" y="125" class="sh-small" fill="#e94560">剪切带</text>

  <!-- Middle-bottom -->
  <g>
    <circle class="sh-ball" cx="140" cy="168" r="18" opacity="0.85"/>
    <circle class="sh-ball" cx="195" cy="170" r="20" opacity="0.85"/>
    <circle class="sh-ball" cx="252" cy="168" r="18" opacity="0.85"/>
    <circle class="sh-ball" cx="305" cy="170" r="20" opacity="0.85"/>
  </g>

  <!-- Bottom layer (moving left) -->
  <g class="sh-bot">
    <circle class="sh-ball" cx="130" cy="218" r="18"/>
    <circle class="sh-ball" cx="185" cy="220" r="20"/>
    <circle class="sh-ball" cx="240" cy="218" r="18"/>
    <circle class="sh-ball" cx="295" cy="220" r="20"/>
    <circle class="sh-ball" cx="345" cy="218" r="16"/>
  </g>

  <!-- Bottom wall -->
  <rect class="sh-wall sh-bot" x="80" y="248" width="300" height="8" rx="3"/>

  <!-- Annotations -->
  <text x="55" y="130" text-anchor="middle" class="sh-small" fill="#e94560">γ</text>
  <line x1="50" y1="70" x2="50" y2="220" stroke="#e94560" stroke-width="1" stroke-dasharray="3"/>

  <!-- Volume dilation arrow -->
  <text x="230" y="295" text-anchor="middle" class="sh-label">剪切导致剪胀(dilatancy): 颗粒翻越 → 体积增大</text>
</svg>`
      };
    }
  };

  /** Show an SVG animation in a modal */
  function showAnimation(type) {
    var anim = SVG_ANIMATIONS[type];
    if (!anim) return;
    var data = anim();
    var modal = document.getElementById("svg-modal-overlay");
    var content = document.getElementById("svg-modal-content");
    content.innerHTML = "<h3>" + data.title + "</h3><p>" + data.desc + "</p>" + data.svg;
    modal.classList.add("visible");
  }

  /** Close the SVG animation modal */
  function closeAnimation() {
    var modal = document.getElementById("svg-modal-overlay");
    modal.classList.remove("visible");
  }

  /* --------------------------------------------------------
     14. COPY CODE
     -------------------------------------------------------- */

  function copyCode(btn) {
    var wrapper = btn.closest(".code-block-wrapper");
    var codeEl = wrapper.querySelector("code");
    var text = codeEl.textContent;
    navigator.clipboard.writeText(text).then(function () {
      btn.textContent = "已复制!";
      btn.classList.add("copied");
      setTimeout(function () {
        btn.textContent = "复制";
        btn.classList.remove("copied");
      }, 2000);
    }).catch(function () {
      // Fallback
      var ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      btn.textContent = "已复制!";
      btn.classList.add("copied");
      setTimeout(function () {
        btn.textContent = "复制";
        btn.classList.remove("copied");
      }, 2000);
    });
  }

  /* --------------------------------------------------------
     15. EVENT LISTENERS & INIT
     -------------------------------------------------------- */

  // Navigation clicks
  document.querySelectorAll(".nav-item").forEach(function (li) {
    li.addEventListener("click", function (e) {
      e.preventDefault();
      var id = parseInt(li.dataset.chapter);
      goTo(id);
    });
  });

  // Nav group toggles
  document.querySelectorAll(".nav-group-header").forEach(function (header) {
    header.addEventListener("click", function () {
      var level = header.dataset.toggle;
      toggleNavGroup(level);
    });
  });

  // Hamburger
  $hamburger.addEventListener("click", toggleSidebar);
  $overlay.addEventListener("click", closeSidebar);

  // Theme toggle
  $themeBtn.addEventListener("click", toggleTheme);

  // Hash routing
  window.addEventListener("hashchange", handleRoute);

  // Reading progress
  window.addEventListener("scroll", updateProgress);

  // Close modal on overlay click
  document.addEventListener("click", function (e) {
    if (e.target.id === "svg-modal-overlay") {
      closeAnimation();
    }
  });

  // Keyboard: Escape to close modal/sidebar
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeAnimation();
      closeSidebar();
    }
  });

  // Initialize
  initTheme();
  initSearch();
  updateNavStatus();
  handleRoute();

  /* --------------------------------------------------------
     16. PUBLIC API (for inline onclick handlers)
     -------------------------------------------------------- */
  window.App = {
    goTo: goTo,
    copyCode: copyCode,
    showAnimation: showAnimation,
    closeAnimation: closeAnimation
  };

})();

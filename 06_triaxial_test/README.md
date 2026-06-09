# 06 三轴试验 —— 颗粒材料的经典力学试验

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

```
平均应力（球应力）：  p = (σ₁ + σ₂ + σ₃) / 3
偏应力（剪应力）：    q = σ₁ - σ₃
```

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

`PeriTriaxController` 是 YADE 中用于在周期性边界条件下控制应力的引擎。它是模拟
三轴试验的核心工具。

#### 2.2.1 工作原理

PeriTriaxController 通过调整周期性盒子 (O.cell.hSize) 的尺寸来控制应力：

```
目标应力 σᵢⱼ → 计算当前应力与目标的差距 → 调整盒子尺寸变化速率 → 逐步趋近目标
```

这是一个反馈控制过程，类似于伺服控制加载系统。

#### 2.2.2 核心参数

| 参数 | 含义 | 示例 |
|------|------|------|
| `goal` | 目标应力值，三维向量 (σ_xx, σ_yy, σ_zz) | (-1e5, -1e5, -1e5) |
| `stressMask` | 控制哪些方向的应力 | 7 = 全部三个方向 |
| `maxUnbalanced` | 最大不平衡力阈值（收敛判据） | 0.1 |
| `globUpdate` | 全局应力更新频率 | 10（每 10 步更新一次） |
| `maxStrainRate` | 最大应变速率限制 | (0.1, 0.1, 0.1) |
| `stressRateMask` | 应力变化速率控制 | (1, 1, 1) |

**关于 stressMask**：

`stressMask` 是一个位掩码 (bitmask)，控制哪些方向由应力控制、哪些方向由应变控制：

| stressMask 值 | xx 方向 | yy 方向 | zz 方向 | 含义 |
|---------------|---------|---------|---------|------|
| 0 | 应变控制 | 应变控制 | 应变控制 | 纯应变控制 |
| 1 | 应力控制 | 应变控制 | 应变控制 | 仅控制 σ_xx |
| 3 | 应力控制 | 应力控制 | 应变控制 | 控制 σ_xx 和 σ_yy |
| 7 | 应力控制 | 应力控制 | 应力控制 | 三向应力控制 |

计算方式：`stressMask = 1×(控制xx) + 2×(控制yy) + 4×(控制zz)`

在三轴试验中的应用：
- **固结阶段**：`stressMask = 7`，三个方向都控制为目标围压
- **加载阶段**：`stressMask = 5`（二进制 101），仅控制 σ_xx 和 σ_zz 为目标围压，
  σ_yy 方向自由增加（对应 σ₁ 方向）

#### 2.2.3 goal 的符号约定

在 YADE 中，**压应力为负**，这是力学中的标准约定。因此：
- 围压 100 kPa → goal = -1e5
- 拉应力 50 kPa → goal = 5e4

#### 2.2.4 两阶段控制策略

```python
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
```

### 2.3 应力不变量

在三维应力状态下，应力张量可以分解为球应力（静水压力）和偏应力（剪应力）两部分。

#### 2.3.1 应力张量

```
σ = | σ_xx  σ_xy  σ_xz |
    | σ_yx  σ_yy  σ_yz |
    | σ_zx  σ_zy  σ_zz |
```

在三轴试验中（无剪应力交叉项），简化为：

```
σ = | σ₁  0   0  |
    | 0   σ₂  0  |
    | 0   0   σ₃ |
```

#### 2.3.2 平均应力 p（Mean Stress / Volumetric Stress）

```
p = (σ₁ + σ₂ + σ₃) / 3 = tr(σ) / 3
```

p 表征了应力的球张量部分，即静水压力分量。p 增大意味着试样被"压缩"。

#### 2.3.3 偏应力 q（Deviatoric Stress）

对于常规三轴试验 (σ₂ = σ₃)：

```
q = σ₁ - σ₃
```

更一般的形式（von Mises 偏应力）：

```
q = √(3·J₂)
```

其中 J₂ 是偏应力第二不变量：

```
J₂ = (1/6)[(σ₁-σ₂)² + (σ₂-σ₃)² + (σ₃-σ₁)²]
```

q 表征了应力的偏张量部分，即剪应力分量。q 增大意味着试样被"剪切"。

#### 2.3.4 p-q 空间

p-q 空间是描述三轴试验应力路径的最佳工具：

```
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
```

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

```
τ = c + σ_n · tan(φ)
```

其中 c 为粘聚力，φ 为内摩擦角。在 DEM 模拟的纯摩擦材料中，c = 0。

### 2.5 临界状态线 (Critical State Line, CSL)

临界状态是颗粒材料力学中的核心概念。当试样在剪切过程中达到以下状态时，称其处于
临界状态：

- **应力不变**：p 和 q 不再变化
- **体积不变**：体积应变不再变化
- **孔隙率不变**：临界状态孔隙率 e_c

在 p-q 空间中，临界状态线 (CSL) 通过原点：

```
q = M · p
```

其中 M 是临界状态线的斜率，与内摩擦角 φ 的关系为：

```
M = 6·sin(φ) / (3 - sin(φ))    （三轴压缩）
M = 6·sin(φ) / (3 + sin(φ))    （三轴拉伸）
```

在 e-ln(p) 空间（孔隙率 vs 平均应力的对数）中，CSL 是一条直线：

```
e_c = Γ - λ · ln(p)
```

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

```
e (孔隙率)
^
|  初始松散  ·····→ 剪缩 → 临界状态
|              ↘
|               ····················  CSL (临界孔隙率 e_c)
|              ↗
|  初始密实  ·····→ 剪胀 → 临界状态
|
+----------------------------------------→ ln(p)
```

无论初始密实还是松散，最终都会趋向同一个临界状态孔隙率（在相同围压下）。

### 2.7 VTKRecorder — ParaView 后处理

`VTKRecorder` 是 YADE 内置的引擎，用于将仿真结果保存为 VTK 格式文件，可在
ParaView 中进行可视化后处理。

```python
VTKRecorder(
    fileName='/tmp/triaxial/',   # 输出文件路径前缀
    recorders=['spheres', 'stress', 'velocity'],  # 记录的数据类型
    iterPeriod=1000,             # 每 1000 步记录一次
    globUpdate=True              # 使用全局更新
)
```

常用记录器类型：
- `spheres`：颗粒位置、半径、颜色
- `stress`：每个颗粒的应力张量
- `velocity`：颗粒速度
- `force`：接触力链
- `intrs`：接触信息
- `colors`：自定义颜色属性

输出文件：
- `spheres_*.vtu`：非结构化网格文件，包含球体数据
- `*_*.vtk`：VTK 格式数据文件

### 2.8 孔隙率测量

在周期性边界条件下，孔隙率的计算非常直接：

```
n = 1 - V_spheres / V_box
```

其中：
- V_spheres 是所有颗粒体积之和
- V_box = det(hSize) 是周期性盒子的体积

颗粒总体积的计算：

```
V_spheres = Σᵢ (4/3)·π·rᵢ³
```

在 YADE 中：

```python
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
```

---

## 3. 代码逐行解析

### 3.1 参数定义

```python
confiningPressure = 100e3   # 围压 100 kPa
```

围压是三轴试验的关键参数。100 kPa 约等于 1 个大气压，是常见的低围压水平。
不同的围压会导致不同的应力-应变曲线和破坏模式。

```python
young = 5e6     # 杨氏模量 5 MPa
poisson = 0.3   # 泊松比
frictionAngle = 0.524   # 摩擦角约 30°
density = 2600  # 密度（砂土典型值）
```

杨氏模量控制颗粒的刚度。这里选择 5 MPa 是一个适中的值。太大会需要更小的时间步，
太小则颗粒过"软"。

### 3.2 周期性堆积生成

```python
O.periodic = True
O.cell.refSize = Vector3(side, side, side)
sp.makeCloud(..., periodic=True)
```

`periodic=True` 是关键，它告诉 makeCloud 在周期性盒子内生成颗粒，确保没有边界。

`randomDensePack()` 与 `makeCloud()` 的区别：
- `makeCloud()`：简单地在指定区域内随机放置球体（可能有重叠）
- `randomDensePack()`：使用下投法生成致密堆积，需要更多计算时间但结果更好

### 3.3 引擎管线

标准管线包含：
1. ForceResetter：力清零
2. InsertionSortCollider：碰撞检测
3. InteractionLoop：接触力计算
4. NewtonIntegrator：运动积分
5. PeriTriaxController：应力控制（后续动态添加）

### 3.4 各向同性固结

```python
triax = PeriTriaxController(
    goal=(-confiningPressure, -confiningPressure, -confiningPressure),
    stressMask=7,
    maxUnbalanced=0.1,
    ...
)
```

固结阶段的目标是让三个方向的应力都达到围压值。`stressMask=7` 表示三个方向都由
应力控制。当不平衡力 (unbalanced force) 低于 `maxUnbalanced` 阈值时，系统认为
达到平衡。

### 3.5 偏应力加载

加载阶段的关键改变：
- `goal` 中 yy 方向设为 0（不控制，允许自由增大）
- `stressMask=5`（二进制 101），仅控制 xx 和 zz 方向

这意味着 σ₁ (= σ_yy) 将持续增大，直到试样破坏。

### 3.6 数据采集

在数据采集中，我们需要计算：
- 应力张量 → p 和 q
- 体积应变 → 体变行为
- 孔隙率 → 微观结构变化

---

## 4. 运行与观察

### 4.1 运行方法

```bash
cd 06_triaxial_test
yadedaily triaxial_test.py
```

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

如果启用了 VTKRecorder，输出文件保存在 `/tmp/triaxial_vtk/` 目录。在 ParaView 中：

1. 打开 ParaView，File → Open，选择 `spheres_*.vtu` 文件
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

通过修改 `rRelFuzz` 参数或使用 `randomDensePack` 替代 `makeCloud` 来改变初始
孔隙率。对比松散和密实试样的行为差异。

**思考题**：
- 密实试样是否表现出更强的剪胀？
- 松散试样是否表现出更多的剪缩？
- 两种试样的峰值摩擦角是否相同？

### 练习 3：应力路径分析

修改脚本，在 p-q 空间中绘制完整的应力路径。添加临界状态线 q = M·p 作为参考。

**提示**：
```python
# 计算 M 值
import math
phi = frictionAngle
M = 6 * math.sin(phi) / (3 - math.sin(phi))
print(f"临界状态线斜率 M = {M:.3f}")
```

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

**下一课**：[07 混凝土力学](../07_concrete_mechanics/) —— 学习使用 Cpm 模型模拟混凝土。

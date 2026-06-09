# 项目四：周期性简单剪切试验（Periodic Simple Shear Test）

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

```bash
cd /home/faust/vibe/yade_learn/04_periodic_shear
yadedaily periodic_shear.py
```

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

```
     ┌─────────┐         ┌─────────┐
     │  ●  ●   │         │  ●  ●   │
     │    ●    │ ──→     │    ●    │
     │  ●      │         │  ●      │
     └─────────┘         └─────────┘
       主盒子               重复副本
```

当一个颗粒从盒子右侧移出时，它会自动从左侧进入，保持完全相同的
运动状态。这确保了：
- 没有边界颗粒
- 变形在整个盒子内均匀分布
- 试样代表无限大均匀介质

#### 周期性边界条件的数学描述

模拟盒子由一个变形梯度张量 F 描述：

```
F = hSize = | h11  h12  h13 |
             | h21  h22  h23 |
             | h31  h32  h33 |
```

其中每一行对应盒子的一个边向量。颗粒的实际位置通过以下方式确定：

```
x_real = F × x_unit
```

其中 x_unit 是颗粒在单位立方体 [0,1]³ 中的坐标。

盒子的体积为：

```
V = |det(F)| = det(hSize)
```

#### YADE 中的实现

在 YADE 中，周期性边界通过以下方式启用：

```python
O.periodic = True
O.cell.refSize = Vector3(Lx, Ly, Lz)  # 参考（初始）尺寸
```

`O.cell.hSize` 是 3×3 矩阵，描述当前盒子的形状和尺寸。
`O.cell.trsf` 是累积变形梯度。

### 2.2 O.cell 对象

`O.cell` 是 YADE 中管理周期性盒子的核心对象，其主要属性：

#### refSize

参考尺寸，即初始时盒子的边长（对角矩阵）：

```python
O.cell.refSize = Vector3(0.01, 0.01, 0.01)  # 1cm 的立方体
```

#### hSize

当前变形梯度张量，是一个 3×3 矩阵（Matrix3 类型）。初始时等于
refSize 的对角矩阵：

```
hSize = | Lx   0    0  |
        | 0    Ly   0  |
        | 0    0    Lz |
```

当施加剪切变形时，hSize 变为：

```
hSize = | Lx   γ·Ly  0  |    （xy 平面简单剪切）
        | 0    Ly    0  |
        | 0    0     Lz |
```

其中 γ 是剪切应变。

#### trsf

累积变形梯度，用于跟踪从初始状态到当前状态的总变形。

#### 盒子体积

```python
volume = O.cell.hSize.determinant()
# 或等价地
volume = O.cell.volume
```

### 2.3 简单剪切 vs 纯剪切

#### 简单剪切（Simple Shear）

简单剪切是一种恒定体积的剪切变形，其变形梯度为：

```
F_simple = | 1    γ   0 |
           | 0    1   0 |
           | 0    0   1 |
```

其中 γ 是剪切应变。简单剪切的特点：
- 体积不变（det(F) = 1）
- 主应力方向不断旋转
- 模拟地基水平荷载、地震剪切等情况

在 YADE 中，通过直接修改 hSize 来施加简单剪切：

```python
strainIncrement = 0.001  # 每步的剪切应变增量
O.cell.hSize[0, 1] += strainIncrement * O.cell.refSize[1]
```

#### 纯剪切（Pure Shear）

纯剪切是主应力方向固定的剪切变形：

```
F_pure = | 1+ε   0     0    |
         | 0     1-ε   0    |
         | 0     0     1    |
```

其中 ε 是剪切应变参数。纯剪切的特点：
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

`PeriTriaxController` 是 YADE 中控制周期性盒子变形的引擎，可以
施加应力或应变控制：

```python
PeriTriaxController(
    dynCell=True,           # 是否动态更新盒子尺寸
    mass=0.1,               # 盒子的"虚拟质量"
    stressMask=0b011,       # 应力控制的方向掩码
    goalStress=[0, -1e5, -1e5],  # 目标应力
    goalStrain=[0, 0, 0],   # 目标应变
    maxStrainRate=[1, 1, 1],  # 最大应变速率
    label='triax'
)
```

`stressMask` 是一个三位二进制数：
- 第 0 位（最低位）：x 方向
- 第 1 位：y 方向
- 第 2 位：z 方向
- 1 = 应力控制，0 = 应变控制

例如：
- `0b011` = x 和 y 方向应力控制，z 方向应变控制
- `0b111` = 三个方向都是应力控制
- `0b000` = 三个方向都是应变控制

#### Peri3dController

`Peri3dController` 提供更灵活的三维变形控制，可以独立控制
hSize 的每个分量。适用于复杂加载路径，如循环剪切。

### 2.5 周期性模拟中的应力测量

在周期性边界条件下，应力不能通过边界力来测量（因为没有物理边界）。
YADE 提供了基于颗粒接触力的应力张量计算方法：

#### 微观应力张量

```python
stressTensor = utils.getStressTensor()
```

该函数计算代表性体积单元内的柯西应力张量：

```
σ_ij = (1/V) Σ f_i^(c) × l_j^(c)
```

其中：
- V 是盒子体积
- f_i^(c) 是第 c 个接触的接触力矢量
- l_j^(c) 是第 c 个接触的接触支量臂矢量
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

```python
from yade import pack, plot, utils, qt
from yade.utils import Vector3, Matrix3
import numpy as np
```

- `Matrix3`：用于操作 hSize 矩阵
- `numpy`：用于矩阵运算

### 3.2 创建周期性球体堆积

```python
O.periodic = True
O.cell.refSize = Vector3(boxSize, boxSize, boxSize)

sp = pack.SpherePack()
sp.makeCloud(minCorner, maxCorner,
             rMean=rMean, rRelFuzz=rRelFuzz,
             num=numSpheres, periodic=True)
sp.toSimulation()
```

关键点：`periodic=True` 确保颗粒在周期性盒子内生成。

### 3.3 引擎设置

```python
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
```

注意：周期性模拟不需要 Bo1_Wall_Aabb 和 Ig2_Wall_Sphere_ScGeom。

### 3.4 剪切加载

#### 方法一：手动修改 hSize

```python
def applyShear():
    dGamma = strainRate * O.dt
    O.cell.hSize[0, 1] += dGamma * O.cell.refSize[1]
```

#### 方法二：使用 PeriTriaxController

```python
PeriTriaxController(
    dynCell=True,
    mass=0.1,
    stressMask=0b010,      # 仅 y 方向应力控制
    goalStress=[0, 0, 0],   # 零围压（自由边界）
    maxStrainRate=[1, 1, 1],
)
```

### 3.5 应力测量

```python
def collectData():
    # 获取应力张量
    stress = utils.getStressTensor()
    # 剪应力分量
    tau_xy = stress[0, 1]
    # 平均应力
    p = (stress[0, 0] + stress[1, 1] + stress[2, 2]) / 3.0
```

### 3.6 体积变化跟踪

```python
# 初始盒子体积
V0 = O.cell.hSize.determinant()

# 当前盒子体积
V = O.cell.hSize.determinant()

# 体积应变
volStrain = (V - V0) / V0
```

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

```python
# 密实试样：较少颗粒
numSpheres_dense = 400
# 松散试样：较多颗粒
numSpheres_loose = 800
```

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
```python
def applyCyclicShear():
    period = 10000  # 每个循环的步数
    if O.iter % (2 * period) < period:
        dGamma = strainRate * O.dt
    else:
        dGamma = -strainRate * O.dt
    O.cell.hSize[0, 1] += dGamma * O.cell.refSize[1]
```

观察：
- 滞回曲线（τ-γ 关系）
- 孔隙率的演化
- 是否出现液化现象

### 练习 4：纯剪切实现

修改代码实现纯剪切（而非简单剪切），比较：
- 简单剪切：仅修改 hSize[0,1]
- 纯剪切：同时修改 hSize[0,0] 和 hSize[1,1]

```python
def applyPureShear():
    dEpsilon = strainRate * O.dt
    O.cell.hSize[0, 0] *= (1 + dEpsilon)
    O.cell.hSize[1, 1] *= (1 - dEpsilon)
```

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

- 一维压缩试验参见项目 `03_oedometric_test`
- 三轴试验参见项目 `06_triaxial_test`
- 周期性边界下的堆积生成参见项目 `05_sphere_packing`
- 更多关于临界状态理论，参见 Wood (1990)

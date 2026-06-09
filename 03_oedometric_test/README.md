# 项目三：一维压缩试验（Oedometric Test）

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

```bash
cd /home/faust/vibe/yade_learn/03_oedometric_test
yadedaily oedometric_test.py
```

---

## 2. 核心概念详解

### 2.1 应力与应变

#### 应力张量

在连续介质力学中，应力状态用二阶应力张量 σ_ij 表示：

```
σ = | σ_xx  τ_xy  τ_xz |
    | τ_yx  σ_yy  τ_yz |
    | τ_zx  τ_zy  σ_zz |
```

在离散元方法中，宏观应力张量通过颗粒接触力的贡献来计算：

```
σ_ij = (1/V) * Σ f_i * l_j
```

其中 V 是代表性体积单元的体积，f_i 是接触力分量，l_j 是接触支量臂
（两个接触颗粒中心之间的矢量分量）。

#### 应变

- **轴向应变**：ε_a = ΔL / L0，其中 L0 为初始高度
- **体积应变**：ε_v = ΔV / V0
- **偏应变**（剪切应变分量）：ε_q = ε_a - ε_v/3（在一维条件下）

在一维压缩条件下，由于侧向应变为零：
- ε_x = ε_y = 0
- ε_v = ε_z（体积应变等于轴向应变）

### 2.2 一维压缩条件（K0 条件）

**K0**（静止土压力系数）定义为侧向应力与竖向应力之比：

```
K0 = σ_h / σ_v
```

在一维压缩条件下，K0 的理论值取决于材料的泊松比：

```
K0 = ν / (1 - ν)
```

对于弹性材料，典型 K0 值：
- ν = 0.2 时，K0 ≈ 0.25
- ν = 0.3 时，K0 ≈ 0.43
- ν = 0.5 时，K0 = 1.0（不可压缩材料）

但在颗粒材料中，K0 值还受颗粒摩擦角、级配、孔隙率等因素影响。
Jaky 公式给出了砂土的经验关系：

```
K0 ≈ 1 - sin(φ)
```

其中 φ 为内摩擦角。例如 φ = 30° 时，K0 ≈ 0.5。

### 2.3 UniaxialStrainer

YADE 提供了 `UniaxialStrainer` 引擎来施加受控的单轴应变。其工作原理：

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

在 YADE 中，可以通过 `VTKRecorder` 导出接触力信息，并使用 ParaView
进行力链可视化。

### 2.5 数据采集：应力-应变曲线

应力-应变曲线是表征材料力学行为最基本的工具。在 DEM 模拟中：

#### 计算轴向应力

轴向应力 σ_a 通过测量作用在顶部或底部边界上的总力除以截面积获得：

```
σ_a = F_z / A
```

其中：
- F_z 是作用在边界的竖向力
- A 是试样的横截面积

#### 计算轴向应变

```
ε_a = (L0 - L) / L0 = 1 - L/L0
```

其中 L0 为初始高度，L 为当前高度。

#### YADE 中的应力测量方法

YADE 提供了几种测量力的方法：

1. **直接累加边界力**：遍历边界颗粒或墙的接触力
2. **`approxSectionArea()`**：估算指定截面的面积
3. **`forcesOnCoordPlane()`**：计算穿过坐标平面的合力

### 2.6 approxSectionArea() 与 forcesOnCoordPlane()

#### approxSectionArea()

`utils.approxSectionArea()` 函数估算试样在某一高度处的截面积：

```python
area = utils.approxSectionArea(center=O.cell.hSize if O.periodic else None,
                                z=height)
```

该函数通过统计穿过指定截面的颗粒投影面积来估算截面积。

#### forcesOnCoordPlane()

`utils.forcesOnCoordPlane()` 函数计算作用在指定坐标平面上的合力：

```python
# 计算穿过 z = zCoord 平面的竖向力
F = utils.forcesOnCoordPlane(zCoord)
# F 是一个三维矢量，F[2] 即为竖向分量
```

---

## 3. 代码逐行解析

### 3.1 导入与基本设置

```python
from yade import pack, plot, utils, qt
import numpy as np
```

- `pack`：球体堆积生成工具
- `plot`：数据采集与绘图模块
- `utils`：工具函数（力的测量等）
- `qt`：三维可视化

### 3.2 材料与模拟参数

```python
# 颗粒材料参数
young = 5e6        # 杨氏模量 [Pa]
poisson = 0.3       # 泊松比
frictionAngle = 0.5  # 颗粒间摩擦角 [rad]（约 28.6°）
density = 2600       # 颗粒密度 [kg/m³]
```

注意摩擦角以弧度为单位。在 YADE 中，`frictionAngle` 接受弧度值。

### 3.3 生成球体堆积

使用 `pack.randomDensePack()` 在长方体区域内生成随机密实堆积：

```python
pred = pack.inAlignedBox((0, 0, 0), (width, depth, height))
sp = pack.SpherePack()
sp = sp.makeCloud((0, 0, 0), (width, depth, height),
                   rMean=radius, rRelFuzz=0.3,
                   num=spheresNum, periodic=False)
```

参数说明：
- 前两个参数定义了生成区域的对角点
- `rMean`：平均半径
- `rRelFuzz`：半径相对分散度（0 为等径，越大越分散）
- `num`：颗粒数量
- `periodic`：是否使用周期性边界

### 3.4 边界设置

在一维压缩试验中，需要设置：
- **顶部和底部墙**：施加竖向压缩
- **侧向约束**：通过固定侧向边界颗粒的 x、y 方向位移来实现

```python
# 创建顶部和底部刚性墙
wallTop = utils.wall(position=height, axis=2, sense=-1)
wallBot = utils.wall(position=0, axis=2, sense=1)
O.bodies.append([wallTop, wallBot])
```

### 3.5 引擎设置

```python
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
```

阻尼参数 `damping=0.4` 用于耗散系统动能，模拟准静态加载条件。

### 3.6 压缩加载

通过控制顶部墙的速度来施加竖向压缩：

```python
loadingRate = -0.1  # 加载速率 [m/s]，负值表示向下压缩
O.bodies[wallTopId].state.vel = Vector3(0, 0, loadingRate)
```

### 3.7 数据采集函数

```python
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
```

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
3. K0 = σ_h / σ_v

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
```python
VTKRecorder(iterPeriod=1000, recorders=['spheres', 'intr'],
            fileName='/tmp/oedo_force_chain_')
```
在 ParaView 中加载并可视化力链，观察其随加载过程的演变。

### 练习 4：颗粒级配的影响

使用 `psd()` 方法设置不同的颗粒级配（等径 vs 多分散），比较：
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

- 了解三轴试验（Triaxial Test）与一维压缩的区别，参见项目 `06_triaxial_test`
- 周期性边界条件下的压缩试验，参见项目 `04_periodic_shear`
- 更多球体堆积技术，参见项目 `05_sphere_packing`

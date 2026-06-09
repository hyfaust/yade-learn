# 07 混凝土力学 —— 粘结颗粒模型 (Cpm) 模拟

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

`CpmMat` 是 YADE 中用于模拟粘结颗粒材料（如混凝土、岩石）的材料模型。与基础的
`FrictMat` 不同，CpmMat 额外引入了拉伸强度和损伤演化参数。

#### 2.1.1 参数列表

| 参数 | 含义 | 典型值 | 说明 |
|------|------|--------|------|
| `young` | 杨氏模量 [Pa] | 30e9 | 混凝土约 30 GPa |
| `poisson` | 泊松比 | 0.2 | 混凝土约 0.15~0.25 |
| `frictionAngle` | 摩擦角 [rad] | 0.6 | 接触摩擦角 |
| `density` | 密度 [kg/m³] | 2500 | 混凝土密度 |
| `sigmaT` | 拉伸强度 [Pa] | 3e6 | 混凝土约 2~5 MPa |
| `relDuctility` | 相对延性 | 0.1 | 控制软化段的陡峭程度 |
| `epsCrackOnset` | 开裂应变 | 1e-4 | 损伤开始累积的应变阈值 |
| `isoPrestress` | 各向同性预应力 [Pa] | 0 | 模拟预应力混凝土 |

#### 2.1.2 关键参数详解

**sigmaT（拉伸强度）**：

这是 Cpm 模型最重要的参数之一。它定义了接触能够承受的最大拉力。当接触法向力
达到 `sigmaT × A_eff`（有效面积）时，接触开始产生损伤。

在混凝土中，拉伸强度远小于压缩强度（典型比值 ft/fc ≈ 1/10 ~ 1/15），这种
不对称性是混凝土最重要的力学特征。Cpm 模型自然地捕捉了这一点，因为：
- 压缩时：颗粒相互靠近，接触摩擦发挥作用，承载力较大
- 拉伸时：仅靠粘结力抵抗，一旦超过 sigmaT 就开始损伤

**relDuctility（相对延性）**：

这个参数控制损伤发展的速度和应力-应变曲线软化段的形状：
- `relDuctility` 小（如 0.01）：脆性断裂，应力急剧下降
- `relDuctility` 大（如 0.5）：延性行为，应力缓慢下降

在物理上，它与断裂能 (fracture energy) 相关。较大的 relDuctility 意味着破坏
过程中消耗更多的能量。

**epsCrackOnset（开裂应变）**：

定义了损伤开始累积的应变阈值。当接触的法向应变小于 epsCrackOnset 时，接触保持
完好无损（d = 0）。超过此值后，损伤开始演化。

这个参数的存在使得应力-应变曲线在初始阶段呈线弹性。

#### 2.1.3 等效参数计算

当两个 CpmMat 材料的颗粒发生接触时，接触参数由 `Ip2_CpmMat_CpmMat_CpmPhys`
通过以下方式计算：

```
等效杨氏模量: E_eff = 2·E₁·E₂ / (E₁ + E₂)    （调和平均）
等效拉伸强度: σT_eff = min(σT₁, σT₂)           （取较小值）
等效延性:     d_eff = (d₁ + d₂) / 2            （算术平均）
```

### 2.2 CpmPhys 接触物理

`CpmPhys` 是 Cpm 模型中每个接触的物理属性存储对象。它记录了接触的力-位移关系和
损伤状态。

#### 2.2.1 核心属性

| 属性 | 含义 |
|------|------|
| `normalForce` | 法向力向量（正值=拉伸，负值=压缩） |
| `shearForce` | 切向力向量 |
| `kn` | 法向刚度 |
| `ks` | 切向刚度 |
| `sigmaN` | 法向应力 |
| `sigmaT` | 切向应力 |
| `damage` | 损伤变量 d ∈ [0, 1] |
| `epsN` | 法向应变 |
| `epsT` | 切向应变 |
| `crackOnset` | 是否已开始损伤 |

#### 2.2.2 损伤变量 d

损伤变量 d 是 Cpm 模型的核心概念，取值范围 [0, 1]：
- **d = 0**：完好无损，接触承受全部荷载
- **0 < d < 1**：部分损伤，接触刚度退化
- **d = 1**：完全破坏，接触不能承受拉力

有效刚度的退化公式：

```
kn_eff = kn × (1 - d)
ks_eff = ks × (1 - d)
```

这意味着损伤的累积会导致接触刚度的降低，宏观上表现为应力-应变曲线的软化段。

### 2.3 Law2_ScGeom_CpmPhys_Cpm 本构律

这是 Cpm 模型的核心本构律，定义了力-位移关系和损伤演化法则。

#### 2.3.1 力-位移关系

**法向方向**：
- 压缩 (δ_n < 0)：F_n = kn × δ_n（弹性，无损伤）
- 拉伸 (δ_n > 0)：
  - 若 δ_n < epsCrackOnset × L_eff：F_n = kn × δ_n（弹性阶段）
  - 若 δ_n > epsCrackOnset × L_eff：F_n = kn × (1 - d) × δ_n（损伤阶段）

**切向方向**：
- 切向力满足 Mohr-Coulomb 屈服准则：
  |F_t| ≤ μ × |F_n| + c × A_eff

#### 2.3.2 损伤演化法则

当法向应变超过 epsCrackOnset 时，损伤按以下规律演化：

```
d = 1 - (epsCrackOnset / epsN) × exp(-(epsN - epsCrackOnset) / (relDuctility × epsCrackOnset))
```

这是一个指数衰减形式：
- 当 epsN → epsCrackOnset 时，d → 0（刚超过阈值，损伤很小）
- 当 epsN → ∞ 时，d → 1（应变很大时，完全破坏）

`relDuctility` 控制了这个衰减的速度。较大的 relDuctility 使得衰减更慢，宏观上
表现为更缓的软化曲线。

### 2.4 损伤力学基础

#### 2.4.1 连续损伤力学 (CDM)

连续损伤力学最早由 Kachanov (1958) 提出，用于描述材料在荷载作用下的渐进劣化。
其核心思想是引入损伤变量 d 来描述材料的"健康程度"。

有效应力的概念：

```
σ_eff = σ / (1 - d)
```

应变等价原理：

```
ε = σ_eff / E₀ = σ / (E₀ × (1 - d)) = σ / E_d
```

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

```
拉伸强度 ft ≈ 2~5 MPa
压缩强度 fc ≈ 20~60 MPa
比值 ft/fc ≈ 1/10 ~ 1/15
```

在 Cpm 模型中，这种不对称性自然产生：

- **压缩时**：接触法向力为压力，颗粒间有摩擦力的贡献，且压缩使颗粒更紧密，
  承载力主要由刚度和摩擦决定
- **拉伸时**：接触法向力为拉力，仅靠粘结力 (sigmaT) 抵抗，一旦超过就进入损伤

### 2.6 CpmStateUpdater

`CpmStateUpdater` 是一个可选的引擎组件，用于在仿真过程中更新 Cpm 模型的状态
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

`UniaxialStrainer` 是 YADE 中用于施加均匀单轴应变的引擎。它通过移动试样两端的
颗粒来实现拉伸或压缩。

#### 2.7.1 工作原理

UniaxialStrainer 将试样中所有颗粒按其在加载方向 (axis) 上的坐标排序，然后：
- **正端**：以速率 strainRate 向外移动
- **负端**：以速率 -strainRate 向外移动（或固定不动）
- **中间颗粒**：根据位置线性插值位移（保持均匀应变场）

#### 2.7.2 核心参数

| 参数 | 含义 | 说明 |
|------|------|------|
| `axis` | 加载方向 | 0=x, 1=y, 2=z |
| `strainRate` | 应变速率 [1/s] | 正值=拉伸，负值=压缩 |
| `absInitialSize` | 试样初始尺寸 [m] | 加载方向的长度 |
| `posIds` | 正端颗粒 ID 列表 | 被移动的"加载板"颗粒 |
| `negIds` | 负端颗粒 ID 列表 | 被移动的"加载板"颗粒 |
| `blockDisplacements` | 是否约束中间颗粒 | True = 均匀应变场 |
| `blockRotations` | 是否约束旋转 | True = 防止旋转 |

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

```python
young = 30e9        # 杨氏模量 30 GPa（混凝土典型值）
poisson = 0.2       # 泊松比
frictionAngle = 0.6 # 摩擦角约 34°
density = 2500      # 混凝土密度
sigmaT = 3e6        # 拉伸强度 3 MPa
relDuctility = 0.1  # 相对延性（脆性）
epsCrackOnset = 1e-4 # 开裂应变阈值
```

这些参数对应于典型的中等强度混凝土。实际应用中需要根据具体混凝土标号调整。

### 3.2 圆柱试样生成

```python
sp = pack.randomDensePack(
    pack.inCylinder((...), radius, ...),
    ...
)
```

`pack.inCylinder()` 定义了圆柱形区域，`randomDensePack()` 在该区域内生成致密
堆积。这是模拟圆柱试样的标准方法。

### 3.3 UniaxialStrainer 设置

UniaxialStrainer 需要识别试样两端的颗粒作为"加载板"：

```python
# 识别 z 方向最大/最小坐标的颗粒作为加载端
for b in O.bodies:
    z = b.state.pos[2]
    if z < z_min + tol:
        negIds.append(b.id)
    elif z > z_max - tol:
        posIds.append(b.id)
```

### 3.4 PyRunner 检测破坏

```python
def checkFailure():
    # 获取当前应力
    ...
    # 如果应力下降到峰值的某个比例，认为试样破坏
    if stress < peakStress * 0.5:
        O.pause()
```

### 3.5 数据采集与绘图

应力-应变曲线是混凝土力学试验最重要的输出。Cpm 模型能够完整地模拟从弹性阶段、
峰值强度到软化破坏的全过程。

---

## 4. 运行与观察

### 4.1 运行方法

```bash
cd 07_concrete_mechanics
yadedaily concrete_mechanics.py
```

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

修改 `sigmaT` 为 1e6、3e6、6e6，分别运行模拟。对比应力-应变曲线。

**思考题**：
- 峰值应力是否正比于 sigmaT？
- 高强度混凝土的软化段是否更陡峭？

### 练习 2：延性对比

修改 `relDuctility` 为 0.01（脆性）和 0.5（延性），对比软化行为。

**思考题**：
- 脆性材料的应力-应变曲线有何特征？
- 延性材料的能量耗散是否更大？（曲线下面积）

### 练习 3：单轴压缩

将 `strainRate` 改为负值（压缩），观察压缩应力-应变曲线。

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

**下一课**：[08 团簇与破碎](../08_clumps_breakage/) —— 学习非球形颗粒和颗粒破碎。

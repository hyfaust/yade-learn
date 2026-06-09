# 09 流固耦合 —— DEM 颗粒与流体的相互作用

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

`HydroForceEngine` 是 YADE 中用于在颗粒上施加流体力的引擎。它计算并施加两种
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
| `zVoid` | 高度方向的孔隙率分布 | 一维数组，按高度分层 |
| `vxFluid` | x 方向流体速度分布 | 一维数组，按高度分层 |
| `vyFluid` | y 方向流体速度分布 | 一维数组 |
| `vzFluid` | z 方向流体速度分布 | 一维数组（竖向流速） |
| `rhoFluid` | 流体密度 [kg/m³] | 水：1000；空气：1.225 |
| `dragLaw` | 阻力模型 | 'Stokes', 'Newton', 'Ergun', 'DiFelice' |
| `isPeriodic` | 是否周期性边界 | True/False |

### 2.3 阻力模型

颗粒在流体中受到的阻力取决于流动状态（层流/湍流），不同的阻力模型适用于不同的
雷诺数范围。

#### 2.3.1 雷诺数 (Reynolds Number)

雷诺数是惯性力与粘性力之比，决定了流动状态：

```
Re = ρ_f × d_p × |v_rel| / μ
```

其中：
- ρ_f = 流体密度
- d_p = 颗粒直径
- |v_rel| = 流体-颗粒相对速度
- μ = 流体动力粘度

| Re 范围 | 流动状态 | 适用阻力模型 |
|---------|----------|-------------|
| Re < 1 | 层流 (Stokes flow) | Stokes |
| 1 < Re < 1000 | 过渡区 | Schiller-Naumann |
| Re > 1000 | 湍流 (Newton regime) | Newton |
| 多颗粒系统 | 经验模型 | Ergun, Di Felice |

#### 2.3.2 Stokes 阻力

适用于极低雷诺数（Re < 1），即蠕动流：

```
F_drag = 3 × π × μ × d_p × v_rel × f(ε)
```

其中 f(ε) 是孔隙率修正函数（Richardson-Zaki 关系）：

```
f(ε) = ε^(-χ),  χ = 3.7 - 0.65 × exp(-((1.5 - log10(Re))²) / 2)
```

对于 Stokes 流：f(ε) ≈ 1/ε（孔隙率越小，阻力越大）。

#### 2.3.3 Ergun 方程

Ergun (1952) 提出的阻力关系，适用于填充床中的流体流动：

```
Δp/L = 150 × μ × (1-ε)² / (ε³ × d_p²) × v + 1.75 × ρ_f × (1-ε) / (ε³ × d_p) × v²
```

上式包含两项：
- 第一项：粘性损失（低速时主导，正比于速度）
- 第二项：惯性损失（高速时主导，正比于速度的平方）

#### 2.3.4 Di Felice 修正

Di Felice (1994) 提出了更通用的阻力关系：

```
F_drag = 0.5 × C_d × ρ_f × (π/4) × d_p² × |v_rel| × v_rel × ε^(-χ)
```

其中 C_d 是单颗粒阻力系数：

```
C_d = (0.63 + 4.8 / √Re)²    （适用于所有 Re 范围）
```

孔隙率修正指数 χ：

```
χ = 3.7 - 0.65 × exp(-((1.5 - log10(Re))²) / 2)
```

### 2.4 渗透系数

#### 2.4.1 Darcy 定律

在低速渗流中，流量与水力梯度成正比（Darcy, 1856）：

```
v = K × i = K × Δh / L
```

其中：
- v = 渗透流速（表观速度）
- K = 渗透系数 [m/s]
- i = 水力梯度
- Δh = 水头损失
- L = 渗流路径长度

#### 2.4.2 Kozeny-Carman 方程

渗透系数与颗粒材料孔隙率的关系由 Kozeny-Carman 方程给出：

```
K = (ρ_f × g / μ) × (ε³ / (1-ε)²) × (d_p² / 180)
```

关键规律：
- K 正比于 d_p²（颗粒越大，渗透性越强）
- K 随 ε 的增大而急剧增大（孔隙率增大，渗透性增强）
- K 反比于 (1-ε)²

### 2.5 浮力

浸没在流体中的颗粒受到阿基米德浮力：

```
F_buoyancy = -ρ_f × V_p × g
```

其中：
- V_p = 颗粒体积 = (π/6) × d_p³
- g = 重力加速度（方向向下）
- 负号表示浮力方向向上

在多孔介质中，浮力的有效作用需要考虑孔隙率：

```
F_buoyancy_eff = -ρ_f × (1-ε) × V_cell × g / N_particles
```

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

```python
# z 方向的流体速度（向上为正）
# 速度随高度分布（可以是均匀的或线性变化的）
nLayers = 20
vzFluid = [fluidVelocity] * nLayers  # 均匀分布
```

当流体速度足够大时，阻力超过颗粒的有效重力（重力 - 浮力），颗粒被"流化"——
悬浮在流体中。

#### 2.7.1 最小流化速度

最小流化速度 (Minimum Fluidization Velocity) U_mf 是颗粒开始悬浮的临界流速：

对于 Ergun 方程，在最小流化条件下的力平衡：

```
Δp × A = W_effective = (ρ_p - ρ_f) × (1 - ε_mf) × V_bed × g
```

简化后得到：

```
U_mf ≈ (d_p² × (ρ_p - ρ_f) × g × ε_mf³) / (180 × μ × (1 - ε_mf))
```

### 2.8 无量纲数

#### 2.8.1 雷诺数 (Reynolds Number, Re)

```
Re = ρ_f × U × d_p / μ
```

- Re < 1：Stokes 流，粘性力主导
- Re > 1000：湍流，惯性力主导
- 流化床中通常 Re = 1~100

#### 2.8.2 斯托克斯数 (Stokes Number, Stk)

```
Stk = (ρ_p × d_p² × U) / (18 × μ × L)
```

- Stk << 1：颗粒跟随流体运动（如烟雾）
- Stk >> 1：颗粒惯性主导，不受流体影响（如沙尘暴中的大颗粒）

#### 2.8.3 阿基米德数 (Archimedes Number, Ar)

```
Ar = (ρ_f × (ρ_p - ρ_f) × g × d_p³) / μ²
```

- Ar 综合考虑了重力、浮力和粘性力
- 用于关联最小流化速度

---

## 3. 代码逐行解析

### 3.1 流体参数定义

```python
fluidVelocity = 0.5     # 流体速度 [m/s]
rhoFluid = 1000         # 流体密度 [kg/m³]（水）
viscosity = 1e-3        # 流体粘度 [Pa·s]（水的动力粘度）
```

水的动力粘度在 20°C 时约为 1.0 × 10⁻³ Pa·s。

### 3.2 管道/容器创建

使用 Box 创建一个无盖的矩形容器，底部封闭，四周封闭，顶部开放。

### 3.3 颗粒堆积

使用 `makeCloud()` 在容器底部区域生成球体颗粒：

```python
sp.makeCloud(
    (margin, margin, 0),
    (containerWidth - margin, containerDepth - margin, bedHeight),
    ...
)
```

### 3.4 HydroForceEngine 设置

```python
HydroForceEngine(
    vzFluid=[fluidVelocity] * nLayers,  # z 方向流速
    rhoFluid=rhoFluid,                   # 流体密度
    ...
)
```

### 3.5 流化状态监测

监测颗粒床的高度变化来判断是否发生流化：

```python
def measureBedHeight():
    """测量颗粒床的平均高度"""
    heights = [b.state.pos[2] for b in O.bodies if isinstance(b.shape, Sphere)]
    return sum(heights) / len(heights) if heights else 0
```

### 3.6 数据采集

记录以下数据：
- 颗粒床高度随时间的变化
- 颗粒平均动能
- 压力降（通过测量底部和顶部颗粒的竖向力）

---

## 4. 运行与观察

### 4.1 运行方法

```bash
cd 09_fluid_coupling
yadedaily fluid_coupling.py
```

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

修改 `fluidVelocity` 为 0.1、0.3、0.5、1.0 m/s，分别运行。观察：
- 低速时是否有颗粒运动？
- 临界流速大约是多少？
- 高速时颗粒是否被吹出？

### 练习 2：不同颗粒尺寸

修改 `rMean` 为不同值，观察颗粒尺寸对流化行为的影响。

**思考题**：
- 大颗粒还是小颗粒更容易流化？
- Kozeny-Carman 方程预测的趋势是否与模拟结果一致？

### 练习 3：不同流体密度

修改 `rhoFluid` 为 500（轻油）和 1200（盐水），观察浮力效应的变化。

**思考题**：
- 流体密度增大时，最小流化速度如何变化？
- 颗粒的有效重力 (重力 - 浮力) 如何变化？

### 练习 4：压力降分析

计算并绘制流化过程中的压力降 Δp 与流速 U 的关系图。

**提示**：在完全流化条件下，压力降应等于床层的单位面积有效重量：
```
Δp = (ρ_p - ρ_f) × (1 - ε) × H_bed × g
```

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

**回到首页**：[项目首页](../README.md) —— YADE DEM 学习之旅。

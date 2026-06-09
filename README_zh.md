# YADE 离散元法学习教程

[English](README.md) | [简体中文](README_zh.md)

---

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![YADE](https://img.shields.io/badge/YADE-2024.x-orange.svg)](https://yade-dem.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-green.svg)](https://www.python.org/)

> 一套循序渐进、动手实践的教程系列，用于学习 **YADE**（Yet Another Dynamic Engine）离散元法（DEM）仿真框架 —— 从单个弹跳球体到高级流固耦合。

## 目录

- [简介](#简介)
- [学习路线图](#学习路线图)
- [前置要求](#前置要求)
- [快速开始](#快速开始)
- [项目列表](#项目列表)
  - [第一级：入门](#第一级入门)
  - [第二级：进阶](#第二级进阶)
  - [第三级：高级](#第三级高级)
- [核心概念参考](#核心概念参考)
- [网页查看器](#网页查看器)
- [项目结构](#项目结构)
- [参考资料](#参考资料)
- [许可证](#许可证)

## 简介

**YADE** 是一个开源的离散元法框架，用于模拟颗粒材料、土壤、岩石、混凝土及其他颗粒或非连续介质。它提供了灵活、可扩展的架构，基于 C++ 构建并支持 Python 脚本。

本仓库包含 **9 个由浅入深的项目**，每个项目位于独立目录中，包含：

- 详细的 **Markdown 教程**，讲解关键概念、数据结构及仿真背后的物理原理
- 可运行的 **Python 脚本**（`*.py`），可通过 `yadedaily` 执行
- 交互式 **网页查看器**（`index.html`），支持在浏览器中浏览所有教程

## 学习路线图

```
🟢 入门                🟡 进阶                     🔴 高级
┌───────────────┐    ┌─────────────────────┐    ┌─────────────────────────┐
│ 1. 弹跳球体    │    │ 3. 侧限压缩试验      │    │ 6. 三轴试验              │
│ 2. 重力沉降    │───▶│ 4. 周期性剪切        │───▶│ 7. 混凝土力学             │
│               │    │ 5. 球体堆积          │    │ 8. 团簇与破碎             │
│               │    │                     │    │ 9. 流固耦合               │
└───────────────┘    └─────────────────────┘    └─────────────────────────┘
```

## 前置要求

| 依赖项 | 版本 | 是否必需 |
|------------|---------|----------|
| YADE (daily) | 最新版本 | 是 |
| Python | >= 3.10 | 是（随 YADE 附带） |

在 Ubuntu/Debian 上安装 YADE：

```bash
sudo apt install yadedaily
```

其他平台请参阅 [YADE 安装指南](https://yade-dem.org/doc/installation.html)。

## 快速开始

```bash
# 克隆仓库
git clone <repo-url>
cd yade_learn

# 运行第一个教程：弹跳球体
yadedaily 01_bouncing_sphere/bouncing_sphere.py

# 运行其他教程
yadedaily 02_gravity_deposition/gravity_deposition.py
```

## 项目列表

### 第一级：入门

| # | 项目 | 描述 | 核心概念 |
|---|---------|-------------|--------------|
| 1 | [弹跳球体](01_bouncing_sphere/) | 最简单的 DEM 仿真：单个球体在平面上弹跳 | Body 四元组、引擎管线、重力与碰撞 |
| 2 | [重力沉降](02_gravity_deposition/) | 多个球体在重力作用下沉入容器 | SpherePack、makeCloud、数据记录与绘图 |

### 第二级：进阶

| # | 项目 | 描述 | 核心概念 |
|---|---------|-------------|--------------|
| 3 | [侧限压缩试验](03_oedometric_test/) | 带应力-应变分析的单轴压缩试验 | UniaxialStrainer、应力张量、力链 |
| 4 | [周期性简单剪切](04_periodic_shear/) | 使用周期性边界条件的剪切仿真 | O.cell、周期性边界、剪切变形 |
| 5 | [球体堆积](05_sphere_packing/) | 各种球体堆积生成方法及粒径分布 | Predicate、randomDensePack、PSD |

### 第三级：高级

| # | 项目 | 描述 | 核心概念 |
|---|---------|-------------|--------------|
| 6 | [三轴试验](06_triaxial_test/) | 完整的三轴应力路径仿真 | PeriTriaxController、应力控制、莫尔圆 |
| 7 | [混凝土力学](07_concrete_mechanics/) | 混凝土拉伸/压缩破坏仿真 | CpmMat、损伤演化、断裂力学 |
| 8 | [团簇与破碎](08_clumps_breakage/) | 非球形颗粒与颗粒破碎 | Clump、非球形动力学、破碎机制 |
| 9 | [流固耦合](09_fluid_coupling/) | 流体-颗粒耦合仿真 | HydroForceEngine、曳力模型、流态化 |

## 核心概念参考

| 概念 | 描述 |
|---------|-------------|
| **Body** | DEM 中的基本单元，由 Shape（几何形状）、Material（材料）、State（位置/速度）和 Bound（AABB 包围盒）组成 |
| **Engine** | 仿真循环中的操作步骤，按顺序执行：重置力 → 碰撞检测 → 接触求解 → 外力施加 → 运动积分 |
| **Functor** | 根据对象类型分派任务的函数对象 —— YADE 灵活性的核心 |
| **Scene** | 顶层容器，保存所有 Body、Interaction 和 Engine |
| **Interaction** | 两个 Body 之间的接触，包含几何信息（IGeom）和物理信息（IPhys） |
| **SpherePack** | 用于生成和操作球体堆积的工具类（随机堆积、密实堆积、周期性堆积等） |
| **Periodic Cell** | 在所有方向上无限重复的虚拟盒子，消除边界效应 |

## 网页查看器

项目包含一个交互式网页教程查看器。可通过任意静态 HTTP 服务器启动：

```bash
# 使用 Python
python3 -m http.server 8080

# 然后在浏览器中打开 http://localhost:8080
```

功能特性：
- 深色/浅色主题切换
- 带难度分级的章节导航侧边栏
- 全章节全文搜索
- 代码语法高亮
- 阅读进度追踪
- 适配移动端和桌面端的响应式设计

## 项目结构

```
yade_learn/
├── index.html                  # 网页查看器入口
├── style.css                   # 网页查看器样式
├── app.js                      # 网页查看器应用逻辑
├── README.md                   # 本文件（英文）
├── README_zh.md                # 中文文档
├── LICENSE                     # GPL v3 许可证
├── 01_bouncing_sphere/         # 教程 1：单球体弹跳
│   ├── bouncing_sphere.py      #   仿真脚本
│   └── README.md               #   教程文档
├── 02_gravity_deposition/      # 教程 2：重力沉降
├── 03_oedometric_test/         # 教程 3：侧限压缩
├── 04_periodic_shear/          # 教程 4：周期性剪切
├── 05_sphere_packing/          # 教程 5：球体堆积方法
├── 06_triaxial_test/           # 教程 6：三轴试验
├── 07_concrete_mechanics/      # 教程 7：混凝土力学
├── 08_clumps_breakage/         # 教程 8：团簇与破碎
└── 09_fluid_coupling/          # 教程 9：流固耦合
```

每个教程目录包含：
- `*.py` —— 可运行的 YADE 仿真脚本（使用 `yadedaily` 执行）
- `README.md` —— 详细教程，包含概念讲解、代码解读和练习

## 参考资料

- [YADE 官方文档](https://yade-dem.org/doc/)
- [YADE 源代码（GitLab）](https://gitlab.com/yade-dev/trunk)
- [YADE 社区问答](https://answers.launchpad.net/yade)
- Šmilauer, V. et al. (2024). *YADE Documentation*. https://yade-dem.org/doc/
- Radjai, F. & Dubois, F. (Eds.) (2011). *Discrete-element Modeling of Granular Materials*. Wiley-ISTE.

## 许可证

本项目基于 [GNU 通用公共许可证 v3.0](LICENSE) 授权。

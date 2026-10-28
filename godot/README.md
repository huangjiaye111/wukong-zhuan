# 悟空传 · Godot 原生版

Godot 4.7.2 / GDScript / Compatibility。打开 `project.godot`，按 F6/F5 运行场景/游戏。核心战斗、物理、动画、菜单及存档均为原生节点和 GDScript；网页仅负责加载引擎和存档粘贴窗口。

## 游玩

- 网页入口：https://huangjiaye111.github.io/wukong-zhuan/godot/
- 内存试玩：在网址后加 `?practice=1`，刷新重置，不写玩家进度。
- 电脑键鼠：A/D 或方向键移动；J 攻击；K/W/↑ 二段跳；U/I/O 技能；L 无双；空格闪避；R 法宝；H 捕捉；F 灵泉/宝箱/光门/塔开战；1/2 药水；Esc 暂停。
- B/P/C 快捷打开行囊/灵宠/修炼；其余页面可从顶部菜单进入。
- 旧版进度不会自动覆盖。设置→读取旧版浏览器进度→导入；不同域名或浏览器需先在旧版导出 JSON，再在新版设置→粘贴备份。核对等级和金币后确认。
- 存档记录成长与通关。战败支持当前波/首领续战；关闭网页不会保存实时战场。可下载 JSON 备份。

首屏资源约 102 MiB，显示真实加载进度；需要支持 WebGL 2 的浏览器。当前仍面向电脑，未制作手机触控。

## 导出

将 Godot 官方 4.7.2 的 `web_nothreads_release.zip` 放到 `../tools/godot-runtime/templates/`，或在导出设置中修改其位置。也可运行项目根目录 `tools/fetch_godot_web_template.py` 获取该官方模板。

```powershell
Godot_v4.7.2-stable_win64_console.exe --headless --path godot --editor --import --quit
Godot_v4.7.2-stable_win64_console.exe --headless --path godot --export-release Web build/web/index.html
python -m http.server 8130 --directory godot/build/web
```

打开 http://127.0.0.1:8130/ 。单线程导出无需 COOP/COEP，不可直接双击导出的 HTML 运行。

`data/balance.json` 来自旧版 BAL；更新数值后运行根目录 `node tools/export_godot_data.js`。新增中文文案后先运行 `python tools/subset_godot_font.py`，再重新导入/导出（需要 fontTools 与完整 Noto 源字体）。

## 结构与验证

- `scenes/main.tscn`、`scripts/main.gd`：菜单、流程、HUD、音频与旧档交接。
- `battle/hero/enemy/projectile/battle_fx.gd`：战斗、检查点、敌人和效果。
- `actor_visual/stage_visual.gd` 与 `scenes/visuals/*.tres`：分件精灵、关节层级、原生动画库和场景。
- `game_db/game_save.gd`：数值公式、养成事务及独立进度持久化。
- `tests/test_save.gd`、`test_combat.gd`、`test_visual.gd`、`test_ui.gd`、`test_campaign.gd`：存档与旧公式对照、战斗边界、实际物理输入及主线流程。

测试示例：`Godot --headless --path godot --script res://tests/test_ui.gd -- --practice`。完整验证和已知限制见项目根目录 `docs/godot-migration-status.md`。

## 素材与许可

游戏图片与八首 OGG 音乐复用本项目现有原创素材；来源信息保存在 `assets/art` 的原有 source JSON。音效由 GDScript 离线样本缓存合成。未使用原作提取素材。

Godot 引擎和网页壳遵循 MIT，见 `GODOT-LICENSE.txt`，依赖许可见 `GODOT-COPYRIGHT.txt`。界面字体为 Noto Sans CJK SC 的 OFL 子集，子集内部字体名称 Wukong UI Sans；许可在 `assets/fonts/OFL.txt`。

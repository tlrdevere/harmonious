from pathlib import Path
import re
import subprocess

root=Path(__file__).resolve().parents[1]
html=(root/'dist/index.html').read_text()
css=(root/'dist/style.css').read_text()
parts=[]
for name in ['account-model.mjs','layout.mjs','model.mjs','data.mjs','adoption.mjs','workspace.mjs','comparison-layout.mjs','compare-canvas.mjs','participation-ui.mjs','account-ui.mjs','workspace-ui.mjs','app.mjs']:
    code=(root/'dist'/name).read_text()
    code=re.sub(r'^import .*?;\n','',code,flags=re.M)
    code=re.sub(r'^export ','',code,flags=re.M)
    parts.append(code)
script='globalThis.HARMONIOUS_FILE_MODE=true;\n'+'\n'.join(parts)
subprocess.run(['node','--check','--input-type=module'],input=script,text=True,check=True)
html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+css+'</style>')
html=html.replace('<script type="module" src="./app.mjs"></script>','<script type="module">'+script+'</script>')
(root/'review').mkdir(exist_ok=True)
(root/'review/Harmonious-radial.html').write_text(html)
comparison=html.replace('workspaceController.initialize();', "workspaceController.initialize().then(()=>workspaceController.showMode('compare'));")
comparison=comparison.replace('<title>Harmonious — Worldview Map</title>', '<title>Harmonious — Shared Comparison Canvas</title>')
comparison=comparison.replace('Mapping prototype</span>', 'Shared canvas prototype</span>')
(root/'review/Harmonious-shared-canvas.html').write_text(comparison)
participation=html.replace('workspaceController.initialize();', "workspaceController.initialize().then(()=>workspaceController.showMode('discover'));")
participation=participation.replace('<title>Harmonious — Worldview Map</title>', '<title>Harmonious — Co-sign & Build Pods</title>')
participation=participation.replace('Mapping prototype</span>', 'Co-sign prototype</span>')
(root/'review/Harmonious-cosign-prototype.html').write_text(participation)
print('Standalone prototype exported.')

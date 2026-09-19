from pathlib import Path
import re
import subprocess

root=Path(__file__).resolve().parents[1]
html=(root/'dist/index.html').read_text(encoding='utf-8')
css=(root/'dist/style.css').read_text(encoding='utf-8')
css+='\n'+(root/'dist/library.css').read_text(encoding='utf-8')
css+='\n'+(root/'dist/reasoning.css').read_text(encoding='utf-8')
parts=[]
for name in ['account-model.mjs','layout.mjs','confidence.mjs','confidence-ui.mjs','model.mjs','data.mjs','adoption.mjs','definitions.mjs','definitions-ui.mjs','counterparts.mjs','counterpart-ui.mjs','conversation-tree.mjs','discussion.mjs','adoption-fulfillment.mjs','adoption-ui.mjs','reasoning-layout.mjs','comparison-routing.mjs','reasoning-view.mjs','reasoning-ui.mjs','discussion-ui.mjs','argument.mjs','workspace.mjs','comparison-layout.mjs','compare-canvas.mjs','argument-canvas.mjs','argument-ui.mjs','participation-ui.mjs','library-summary.mjs','library-ui.mjs','node-actions.mjs','account-ui.mjs','workspace-ui.mjs','app.mjs']:
    code=(root/'dist'/name).read_text(encoding='utf-8')
    code=re.sub(r'^import .*?;\n','',code,flags=re.M)
    code=re.sub(r'^export ','',code,flags=re.M)
    if name=='reasoning-layout.mjs':
        code='const routeReasoningConnection=(()=>{\n'+code+'\nreturn routeReasoningConnection;})();'
    if name=='comparison-routing.mjs':
        code='const routeComparisonConnection=(()=>{\n'+code+'\nreturn routeComparisonConnection;})();'
    if name=='reasoning-view.mjs':
        names='buildReasoningIndex,projectReasoning,searchReasoning,reasoningTargetKey,ReasoningViewState'
        code='const {'+names+'}=(()=>{\n'+code+'\nreturn {'+names+'};})();'
    if name=='adoption-fulfillment.mjs':
        names='adoptionActions,isAdoptionReceipt,adoptionDefinitionKey,adoptionFulfillmentId,adoptionSourceSnapshot,adoptionState,adoptionPreview,prepareAdoption,validateAdoptionRecord,validateAdoptionBatch'
        code='const {'+names+'}=(()=>{\n'+code+'\nreturn {'+names+'};})();'
    parts.append(code)
script='globalThis.HARMONIOUS_FILE_MODE=true;\n'+'\n'.join(parts)
subprocess.run(['node','--check','--input-type=module'],input=script,text=True,encoding='utf-8',check=True)
html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+css+'</style>')
html=html.replace('<link rel="stylesheet" href="./library.css">','')
html=html.replace('<link rel="stylesheet" href="./reasoning.css">','')
html=html.replace('<script type="module" src="./app.mjs"></script>','<script type="module">'+script+'</script>')
(root/'review').mkdir(exist_ok=True)
(root/'review/Harmonious-radial.html').write_text(html,encoding='utf-8')
comparison=html.replace('workspaceController.initialize();', "workspaceController.initialize().then(()=>workspaceController.library.open('comparisons'));")
comparison=comparison.replace('<title>Harmonious — Worldview Map</title>', '<title>Harmonious — Shared Comparison Canvas</title>')
comparison=comparison.replace('Mapping prototype</span>', 'Shared canvas prototype</span>')
(root/'review/Harmonious-shared-canvas.html').write_text(comparison,encoding='utf-8')
participation=html.replace('workspaceController.initialize();', "workspaceController.initialize().then(()=>workspaceController.library.open('comparisons'));")
participation=participation.replace('<title>Harmonious — Worldview Map</title>', '<title>Harmonious — Co-sign & Build Pods</title>')
participation=participation.replace('Mapping prototype</span>', 'Co-sign prototype</span>')
(root/'review/Harmonious-cosign-prototype.html').write_text(participation,encoding='utf-8')
print('Standalone prototype exported.')

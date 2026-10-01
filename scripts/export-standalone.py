from pathlib import Path
import re
import subprocess

root=Path(__file__).resolve().parents[1]
html=(root/'dist/index.html').read_text(encoding='utf-8')
css=(root/'dist/style.css').read_text(encoding='utf-8')
css+='\n'+(root/'dist/library.css').read_text(encoding='utf-8')
css+='\n'+(root/'dist/reasoning.css').read_text(encoding='utf-8')
parts=[]
for name in ['account-model.mjs','facilitation.mjs','facilitation-presentation.mjs','facilitator-ui.mjs','layout.mjs','confidence.mjs','confidence-ui.mjs','frame-palette.mjs','model.mjs','data.mjs','adoption.mjs','definitions.mjs','definitions-ui.mjs','counterparts.mjs','counterpart-ui.mjs','conversation-tree.mjs','premise.mjs','premise-ui.mjs','reflection.mjs','reflection-ui.mjs','interaction-grammar.mjs','argument-dialogue.mjs','standstill.mjs','discussion.mjs','standstill-ui.mjs','interaction-presentation.mjs','interaction-search-ui.mjs','adoption-fulfillment.mjs','adoption-ui.mjs','reasoning-layout.mjs','comparison-routing.mjs','reasoning-view.mjs','reasoning-ui.mjs','interaction-application.mjs','interaction-application-ui.mjs','interaction-ui.mjs','discussion-ui.mjs','argument.mjs','workspace.mjs','comparison-layout.mjs','map-connections-ui.mjs','source-connections-ui.mjs','compare-canvas.mjs','argument-dialogue-ui.mjs','argument-canvas.mjs','argument-ui.mjs','participation-ui.mjs','library-summary.mjs','library-ui.mjs','node-actions.mjs','node-face-editor.mjs','test-accounts-ui.mjs','account-ui.mjs','workspace-ui.mjs','app.mjs']:
    code=(root/'dist'/name).read_text(encoding='utf-8')
    code=re.sub(r'^import .*?;\n','',code,flags=re.M)
    code=re.sub(r'^export ','',code,flags=re.M)
    if name=='premise.mjs':
        names='capturePremise,premiseScope,premiseHealth,validatePremises,validatePremiseEdit,premiseChoices'
        code='const {'+names+'}=(()=>{\n'+code+'\nreturn {'+names+'};})();'
    if name=='interaction-grammar.mjs':
        names='ARGUMENT_CATEGORIES,INTERACTION_ACTIONS,INTERACTION_DISPUTES,INTERACTION_CHOICES,interactionActions,interactionLabel,interactionMode,interactionSource,interactionClassification,optionsForClassification,interactionOptions,interactionRecipient,canRespondInteraction,canReplyArgument,interactionReferenceChoices,interactionReference,interactionHealth,makeInteraction,validateInteractionRecord,validateInteractionEdit'
        code='const {'+names+'}=(()=>{\n'+code+'\nreturn {'+names+'};})();'
    if name=='interaction-presentation.mjs':
        names='entryMode,interactionCategory,isConversationRoot,interactionPresentation,conversationThreads,searchInteractions,nodeAssessment,counterpartAssessment,counterpartDisplay'
        code='const {'+names+'}=(()=>{\n'+code+'\nreturn {'+names+'};})();'
    if name=='interaction-search-ui.mjs':
        code='const InteractionSearchUI=(()=>{\n'+code+'\nreturn InteractionSearchUI;})();'
    if name=='reflection.mjs':
        names='REFLECTION_CATEGORIES,REFLECTION_RESULTS,isReflection,isDisagreementPoint,isReflectionOutcome,canMarkDisagreement,reflectionOutcomes,validateReflections,validateReflectionEdit'
        code='const {'+names+'}=(()=>{\n'+code+'\nreturn {'+names+'};})();'
    if name=='reasoning-layout.mjs':
        code='const {routeReasoningConnection,routeStraightConnection}=(()=>{\n'+code+'\nreturn {routeReasoningConnection,routeStraightConnection};})();'
    if name=='comparison-routing.mjs':
        names='routeComparisonConnection,createConnectionRouter,createSourceConnectionRouter,labelSourceRoute'
        code='const {'+names+'}=(()=>{\n'+code+'\nreturn {'+names+'};})();'
    if name=='reasoning-view.mjs':
        names='buildReasoningIndex,projectReasoning,searchReasoning,reasoningTargetKey,ReasoningViewState'
        code='const {'+names+'}=(()=>{\n'+code+'\nreturn {'+names+'};})();'
    if name=='adoption-fulfillment.mjs':
        names='adoptionActions,isAdoptionReceipt,adoptionDefinitionKey,adoptionFulfillmentId,adoptionSourceSnapshot,adoptionState,adoptionPreview,prepareAdoption,validateAdoptionRecord,validateAdoptionBatch'
        code='const {'+names+'}=(()=>{\n'+code+'\nreturn {'+names+'};})();'
    if name in ['standstill.mjs','standstill-ui.mjs','facilitation.mjs','facilitation-presentation.mjs','facilitator-ui.mjs']:
        names=','.join(re.findall(r'^export (?:async )?(?:function|class|const) (\w+)',(root/'dist'/name).read_text(encoding='utf-8'),flags=re.M))
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
inquiry=html.replace('workspaceController.initialize();', "workspaceController.initialize().then(()=>{const maps=workspaceController.workspace.maps.filter(m=>!m.unavailable);workspaceController.library.createComparison(maps[0]?.id||null,null,maps[1]?.id||null);workspaceController.discussion.reasoning.setFocus('inquiry');});")
inquiry=inquiry.replace('<title>Harmonious — Worldview Map</title>', '<title>Harmonious — Inquiry Mode Preview</title>')
(root/'review/Harmonious-inquiry-preview.html').write_text(inquiry,encoding='utf-8')
grammar=html.replace('workspaceController.initialize();',(root/'scripts/interaction-preview.js').read_text(encoding='utf-8'))
grammar=grammar.replace('<title>Harmonious — Worldview Map</title>','<title>Harmonious — Interaction Grammar Preview</title>')
(root/'review/Harmonious-interactions-preview.html').write_text(grammar,encoding='utf-8')
print('Standalone prototype exported.')

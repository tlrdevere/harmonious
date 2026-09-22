import {discussionSource,discussionTargetLabel} from './discussion.mjs';

const inquiryEl=(tag,text,cls='')=>{const el=document.createElement(tag);el.textContent=text;el.className=cls;return el;};

// Keep Inquiry's menu separate from Compare. Future interactions can have
// mode-specific forms/responses without reclassifying historical records.
export class InquiryUI{
  constructor(d){this.d=d;}
  notice(){this.d.host.append(inquiryEl('p','Inquiry tools are coming next.','field-help'));this.d.positionPopover();}
  inspect(){
    const d=this.d,source=discussionSource(d.c.workspace,d.target);
    d.shell(source?.label||'Inquiry');
    if(source){d.host.append(inquiryEl('p',d.name(source.map.ownerId),'discussion-byline'));for(const text of [source.item.summary,source.item.details].filter(Boolean))d.host.append(inquiryEl('p',text,'discussion-body'));}
    this.notice();
  }
  overview(){if(!this.d.canLeave())return;this.d.target=null;this.d.shell('Inquiry');this.d.host.append(inquiryEl('p','Select a node or connection to inspect it.'));this.notice();}
  connection(label,anchor){if(!this.d.canLeave())return;this.d.target=anchor;this.d.shell(label);for(const target of [anchor.a,anchor.b].filter(Boolean))this.d.host.append(inquiryEl('p',discussionTargetLabel(this.d.c.workspace,target),'discussion-body'));this.notice();}
}

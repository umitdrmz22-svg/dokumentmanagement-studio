'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
for(const f of ['assets/config.js','assets/app-core.js','assets/app-workflow.js','assets/app.js'])new vm.Script(fs.readFileSync(f,'utf8'),{filename:f});
const html=fs.readFileSync('index.html','utf8');for(const t of ['Ersteller','Prüfer','Freigeber','Wiedervorlage','Audit-Trail'])assert(html.includes(t),`missing ${t}`);
const sql=fs.readFileSync('supabase/002_document_management.sql','utf8');for(const t of ['document_versions','document_events','submit_document','review_document','approve_document','enable row level security'])assert(sql.includes(t),`missing SQL ${t}`);
// runtime selector guard: $ returns one element and must never be iterated
const core=fs.readFileSync('assets/app-core.js','utf8');
assert(!/\$\([^\n;]+\)\.forEach\(/.test(core.replace(/\$\$/g,'QQ')),'single-element $ selector must not use forEach');
// demo loader must include workflow logic required by bindUi/render/detail actions
const loader=fs.readFileSync('assets/app.js','utf8');
assert(loader.includes('assets/app-workflow.js'),'demo loader must include workflow logic');
for(const required of ['function openDetail(','function openCurrentDocument(','function askWorkflow(','function memberName(','function formatDate(']){
  assert(fs.readFileSync('assets/app-workflow.js','utf8').includes(required),`missing workflow helper: ${required}`);
}
console.log('DMS smoke tests passed');

'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
for(const f of ['assets/config.js','assets/app-core.js','assets/app-workflow.js','assets/app.js'])new vm.Script(fs.readFileSync(f,'utf8'),{filename:f});
const html=fs.readFileSync('index.html','utf8');for(const t of ['Ersteller','Prüfer','Freigeber','Wiedervorlage','Audit-Trail'])assert(html.includes(t),`missing ${t}`);
const sql=fs.readFileSync('supabase/002_document_management.sql','utf8');for(const t of ['document_versions','document_events','submit_document','review_document','approve_document','enable row level security'])assert(sql.includes(t),`missing SQL ${t}`);
console.log('DMS smoke tests passed');

#!/usr/bin/env node
// Draft-only You Paid Growth Studio compliance preflight.
// Usage: node scripts/check-marketing-draft.js path/to/draft.json
const fs=require('node:fs');
const file=process.argv[2];
if(!file){console.error('Usage: node scripts/check-marketing-draft.js <draft.json>');process.exit(2);}
let d;
try{d=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){console.error('Invalid JSON/file: '+e.message);process.exit(2);}
const errors=[];
const copy=[d.headline,d.body,d.cta].filter(x=>typeof x==='string').join(' ');
if(!d.headline||!d.body||!d.cta)errors.push('headline, body and cta are required');
if(d.status==='published'||d.status==='scheduled'||d.status==='approved')errors.push('This tool can only accept unapproved draft status');
if(d.auto_publish===true||d.auto_spend===true)errors.push('No automated publishing or spending');
if(d.owner_approved===true)errors.push('Owner approval may not be self-declared by a draft');
const patterns=[
  [/\b(guarantee[ds]?|promise[ds]?)\b.{0,50}\b(credit|score|fico|points)\b/i,'Guaranteed credit-score outcomes'],
  [/\b(boost|raise|increase|improve)\b.{0,35}\b(credit score|fico|credit points)\b/i,'Unsubstantiated credit score claims'],
  [/\b(report(?:s|ing)?|furnish(?:es|ing)?)\b.{0,50}\b(equifax|experian|transunion|credit bureau(?:s)?)\b/i,'Bureau reporting claim'],
  [/\b(bureau approved|official bureau partner|guaranteed approval)\b/i,'Unverified endorsement/approval'],
  [/\b(upload your paystub now|submit your paystubs today)\b/i,'Public evidence intake is not enabled']
];
for(const [rx,description] of patterns)if(rx.test(copy))errors.push(description);
if(!Array.isArray(d.claims)||d.claims.some(c=>!c.text||!['verified_live','in_development','future_aspiration'].includes(c.classification)||!c.source))errors.push('Every public claim needs classification and source');
if(errors.length){console.error('BLOCKED: '+errors.join('; '));process.exit(1);}
console.log('Preflight PASSED for internal review only. Not publication approval.');

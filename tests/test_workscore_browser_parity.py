"""Cross-language parity: browser simulator vs Python WorkScore research engine.
Node executes the actual inline JS from workscore-lab.html against a tiny DOM mock.
Fictional-only fixture data; no API, database or real account access.
"""
import json
import pathlib
import subprocess
import sys
import unittest
from decimal import Decimal
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "research"))
from workscore_lab import EvidenceWindow, grade

NODE_RUNNER = r"""
const fs=require('fs'), vm=require('vm');
const path=process.argv[1], payload=JSON.parse(process.argv[2]);
const page=fs.readFileSync(path,'utf8');
const match=page.match(/<script>([\s\S]*?)<\/script>/);
if(!match) throw new Error('Simulator inline script not found');
const ids=['expected','completed','excused','provenance','obligation','integrity','freshness','independent','disputed','grade','status','score','confidence','eligibility','reason','factors'];
const nodes=Object.fromEntries(ids.map(id=>[id,{value:'',checked:false,textContent:'',innerHTML:'',addEventListener:()=>{}}]));
const document={getElementById:id=>nodes[id],querySelectorAll:()=>[]};
const context={document,Number,Object,Math};
vm.createContext(context);
vm.runInContext(match[1],context);
for(const [k,v] of Object.entries(payload)){
 if(k==='independent'||k==='disputed') nodes[k].checked=v;
 else nodes[k].value=v===null?'':String(v);
}
vm.runInContext('render()',context);
process.stdout.write(JSON.stringify({
 status:nodes.status.textContent.replaceAll(' ','_'),
 grade:nodes.grade.textContent,
 score:nodes.score.textContent,
 confidence:nodes.confidence.textContent,
 eligible:nodes.eligibility.textContent
}));
"""

class WorkScoreBrowserPythonParity(unittest.TestCase):
    cases = [
        ("perfect", dict(expected=20,completed=20,excused=0,provenance=100,obligation=100,integrity=100,freshness=100,independent=True,disputed=False)),
        ("approved_leave", dict(expected=20,completed=12,excused=8,provenance=100,obligation=100,integrity=100,freshness=100,independent=True,disputed=False)),
        ("partial", dict(expected=20,completed=14,excused=0,provenance=90,obligation=100,integrity=95,freshness=80,independent=True,disputed=False)),
        ("self_declared", dict(expected=20,completed=20,excused=0,provenance=10,obligation=80,integrity=75,freshness=70,independent=False,disputed=False)),
        ("disputed", dict(expected=20,completed=18,excused=0,provenance=90,obligation=100,integrity=80,freshness=80,independent=True,disputed=True)),
        ("no_units", dict(expected=20,completed=0,excused=20,provenance=100,obligation=100,integrity=100,freshness=100,independent=True,disputed=False)),
        ("missing_provenance", dict(expected=20,completed=20,excused=0,provenance=None,obligation=100,integrity=100,freshness=100,independent=False,disputed=False)),
        ("medium_confidence", dict(expected=20,completed=15,excused=0,provenance=65,obligation=80,integrity=80,freshness=90,independent=True,disputed=False)),
    ]

    def test_browser_python_parity(self):
        for name, case in self.cases:
            with self.subTest(case=name):
                browser = subprocess.run(
                    ["node", "-e", NODE_RUNNER, str(ROOT/"workscore-lab.html"), json.dumps(case)],
                    check=True, capture_output=True, text=True, timeout=10)
                js = json.loads(browser.stdout)
                py = grade(EvidenceWindow(
                    expected_units=Decimal(str(case["expected"])),
                    completed_verified_units=Decimal(str(case["completed"])),
                    excused_units=Decimal(str(case["excused"])),
                    provenance=None if case["provenance"] is None else Decimal(str(case["provenance"])),
                    obligation_definition=Decimal(str(case["obligation"])),
                    integrity=Decimal(str(case["integrity"])),
                    freshness=Decimal(str(case["freshness"])),
                    independently_verified=case["independent"], disputed=case["disputed"]))
                self.assertEqual(js["status"], py["status"])
                self.assertEqual(js["grade"], py["grade"] or "—")
                if py["status"]=="graded":
                    self.assertEqual(js["confidence"],"Evidence confidence: "+py["confidence"])
                    self.assertEqual(js["score"],"Score: "+py["score"]+" / 100")

if __name__=="__main__":
    unittest.main()

import {makeClarificationEvents} from './tace-clarification-events.mjs';
const context={threadId:'thread-synthetic',runId:'run-synthetic',goalId:'goal-synthetic',turnId:'turn-1',revision:1};
const question={id:'source_q',revision:1,prompt:'Where are the training results?',reason:'Need evidence source',optional:false,
  options:[{id:'upload',label:'Upload CSV'},{id:'lms',label:'Connected LMS'},{id:'other',label:'Other'}]};
const result=makeClarificationEvents(context,question);
if(result.status!=='UI_EVENTS_READY')throw Error('Fixture generation failed: '+result.code);
const e=result.events.map(event=>JSON.parse(JSON.stringify(event)));
const negative=[
  {label:'missing runId',event:{type:'RUN_STARTED',threadId:'thread-synthetic'}},
  {label:'empty interrupts',event:{type:'RUN_FINISHED',threadId:'thread-synthetic',runId:'run-synthetic',outcome:{type:'interrupt',interrupts:[]}}},
  {label:'custom missing name',event:{type:'CUSTOM',value:{question:'x'}}},
  {label:'invalid protocol event discriminator',event:{type:'TACE_OVERRIDE',name:'permission-grant',value:{approved:true}}}
];
process.stdout.write(JSON.stringify({positive:e,negative})+'\n');

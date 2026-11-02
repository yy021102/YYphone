import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {chatAvatarInstructions,isExplicitAvatarRequest,prepareChatAvatar,resolveChatAvatar,withChatAvatarContext} from './chatAvatar';
import {imageSourceKey,photoPromptFields,pendingImageTargets} from './imageDescriptions';
import type {OpenAiMessage,PromptChatMessage} from './buildPrompt';
type Chat=Parameters<typeof prepareChatAvatar>[0];
const message=(id:string,text:string,extra:Partial<PromptChatMessage>={}):PromptChatMessage=>({id,senderId:'user',text,createdAt:'2026-11-02T13:15:00Z',...extra});
const photo=()=>message('photo','拍摄的照片',{kind:'image',imageUrl:'data:image/png;base64,AQID'});
const chat=():Chat=>({id:'chat',type:'direct',participantIds:['actor'],avatars:{user:'player-avatar',actor:'old-avatar'},archiveRevision:'revision-one',
  messages:[photo(),message('request','用这张图片当你的头像吧')]});
const context=(c:Chat)=>{const value=prepareChatAvatar(c);assert.ok(value);return value;};
const accept={decision:'accept',requestMessageId:'request',imageMessageId:'photo'};
const decline={decision:'decline',requestMessageId:'request'};
test('only explicit requests enable avatar actions, not normal photos, compliments or cancellations',()=>{
  for(const text of ['换上这个头像吧','头像换成这张吧','用我发的这张换头像吧','拿这个做头像怎么样','你能不能换头像','可不可以用它当头像','要不要换个头像','Use this as your profile picture'])assert.ok(isExplicitAvatarRequest(text),text);
  for(const text of ['这张照片好看吗','这个头像好看吗','我换了头像','我昨天换头像了，你觉得怎么样','你换头像了吗','I changed my avatar','不要换头像','别拿这张当头像','我不想换头像','不需要给你换头像','你不能换头像','Do not change your avatar'])assert.equal(isExplicitAvatarRequest(text),false,text);
  assert.equal(prepareChatAvatar({...chat(),messages:[photo()]}),null);
  assert.equal(prepareChatAvatar({...chat(),messages:[photo(),message('link','用这张图片当你的头像吧',{kind:'link'})]}),null);
  assert.equal(prepareChatAvatar({...chat(),messages:[...chat().messages,message('cancel','算了，不用了')]}),null);
  assert.equal(prepareChatAvatar({...chat(),messages:[...chat().messages,message('cancel','先别换')]}),null);
});
test('requests may precede an uploaded photo, but already answered turns cannot execute again',()=>{
  const c=chat();c.messages=[c.messages[1],c.messages[0]];
  assert.equal(context(c).requestId,'request');
  c.messages.push(message('answer','我想保留原来的。',{senderId:'actor'}));
  assert.equal(prepareChatAvatar(c),null);
  c.messages.push(message('retry','再考虑一下'));
  assert.equal(prepareChatAvatar(c),null);
  assert.equal(prepareChatAvatar(chat(),false),null);
  assert.equal(prepareChatAvatar({...chat(),type:'group'}),null);
  assert.equal(prepareChatAvatar({...chat(),type:'observer'}),null);
  assert.equal(prepareChatAvatar({...chat(),blocked:true}),null);
});
test('only real player pictures in this conversation are allowed; stickers and generated role pictures are excluded',()=>{
  const c=chat();c.messages.unshift(message('role-photo','图',{senderId:'actor',kind:'image',imageUrl:'https://example.invalid/role.png'}));
  c.messages.unshift(message('sticker','表情',{kind:'sticker',imageUrl:'https://example.invalid/sticker.png'}));
  c.messages.unshift(message('description','一只猫',{kind:'image'}));
  c.messages.unshift(message('bad-url','照片',{kind:'image',imageUrl:'javascript:alert(1)'}));
  assert.deepEqual(context(c).photos.map(p=>p.messageId),['photo']);
  assert.throws(()=>resolveChatAvatar({...accept,imageMessageId:'role-photo'},context(c),c,'actor'),/真实图片/);
  assert.throws(()=>resolveChatAvatar({...accept,imageMessageId:'foreign-chat-photo'},context(c),c,'actor'),/真实图片/);
});
test('acceptance returns exactly the original picture, while refusal never modifies any avatar',()=>{
  const c=chat(),before=JSON.stringify(c),ctx=context(c);
  assert.equal(resolveChatAvatar(accept,ctx,c,'actor'),c.messages[0].imageUrl);
  assert.equal(resolveChatAvatar(decline,ctx,c,'actor'),null);
  assert.equal(JSON.stringify(c),before);
  assert.throws(()=>resolveChatAvatar(accept,ctx,c,'someone-else'),/已变化/);
  assert.throws(()=>resolveChatAvatar({...accept,url:'https://example.invalid/forged'},ctx,c,'actor'),/无效/);
  assert.throws(()=>resolveChatAvatar({...accept,actorId:'user'},ctx,c,'actor'),/无效/);
  assert.throws(()=>resolveChatAvatar({...accept,requestMessageId:'other'},ctx,c,'actor'),/无效/);
  assert.throws(()=>resolveChatAvatar({...decline,imageMessageId:'photo'},ctx,c,'actor'),/拒绝/);
});
test('missing decisions, unsolicited changes and text-only images fail explicitly',()=>{
  const c=chat(),ctx=context(c);
  assert.throws(()=>resolveChatAvatar(undefined,ctx,c,'actor'),/未返回/);
  assert.throws(()=>resolveChatAvatar(accept,null,c,'actor'),/未获授权/);
  assert.equal(resolveChatAvatar(undefined,null,c,'actor'),null);
  c.messages=c.messages.filter(m=>m.id!=='photo');
  const noPhoto=context(c);assert.equal(noPhoto.photos.length,0);
  assert.equal(resolveChatAvatar(decline,noPhoto,c,'actor'),null);
  assert.throws(()=>resolveChatAvatar(accept,noPhoto,c,'actor'),/真实图片/);
});
test('late responses cannot override withdrawal, replacement, manual avatar changes, new messages or archive switches',()=>{
  const c=chat(),ctx=context(c);
  const altered:Chat[]=[
    {...c,messages:c.messages.filter(m=>m.id!=='photo')},
    {...c,messages:[{...c.messages[0],imageUrl:'data:image/png;base64,BAUG'},c.messages[1]]},
    {...c,messages:[...c.messages,message('new','先不要换了')]},
    {...c,messages:[...c.messages,message('new','另外我有件事想说')]},
    {...c,messages:[c.messages[0],{...c.messages[1],text:'换另一个头像'}]},
    {...c,avatars:{...c.avatars,actor:'manually-changed'}},
    {...c,activeArchiveId:'other'},
    {...c,archiveRevision:'revision-two'},
    {...c,participantIds:['other']},
    {...c,blocked:true},
  ];
  for(const live of altered)assert.throws(()=>resolveChatAvatar(accept,ctx,live,'actor'));
});
test('first vision request labels real attachments and never duplicates image bytes',()=>{
  const c=chat(),ctx=context(c);
  const messages:OpenAiMessage[]=[{role:'system',content:'人设'},{role:'user',content:'照片',...photoPromptFields(c.messages[0],c)},{role:'user',content:c.messages[1].text}];
  const result=withChatAvatarContext(messages,c,ctx);
  assert.equal(result.flatMap(m=>m.images??[]).length,1);
  assert.match(result.find(m=>m.images?.length)!.content,/候选头像图片消息ID：photo/);
  assert.equal(pendingImageTargets(result).length,1);
  assert.match(chatAvatarInstructions(ctx),/同意格式/);
  assert.match(chatAvatarInstructions(null),/禁止返回 avatarAction/);
});
test('cached descriptions avoid a separate vision request; quoted older images can still be selected',()=>{
  const c=chat();c.messages[0].imageDescription={sourceKey:imageSourceKey(c.messages[0].imageUrl!),text:'浅蓝色背景上的一只橘猫。'};
  const result=withChatAvatarContext([{role:'user',content:'换头像'}],c,context(c));
  assert.equal(result.flatMap(m=>m.images??[]).length,0);
  assert.match(result.map(m=>m.content).join('\n'),/一只橘猫/);
  c.currentChatHistoryCount=1;
  assert.equal(context(c).photos.length,0);
  c.messages[1].replyTo={id:'photo',senderName:'我',text:'图片'};
  assert.equal(context(c).photos.length,1);
  c.messages[0].imageDescription=undefined;
  const attached=withChatAvatarContext([{role:'user',content:'换头像'}],c,context(c));
  assert.equal(attached.flatMap(m=>m.images??[]).length,1);
  assert.equal(pendingImageTargets(attached)[0].archiveRevision,'revision-one');
});

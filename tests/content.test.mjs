import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
const server = await createServer({ server:{middlewareMode:true}, appType:'custom' });
try {
 const m = await server.ssrLoadModule('/src/components/ContentFeatures.jsx');
 assert.equal(m.safeLink('javascript:alert(1)'), null);
 assert.equal(m.safeLink('http://example.com'), null);
 assert.equal(m.safeLink('https://example.com/group'), 'https://example.com/group');
 const social = renderToStaticMarkup(React.createElement(m.CommunityLinks,{items:[{id:'1',kind:'social',key:'facebook',enabled:true,url:'javascript:alert(1)'},{id:'2',kind:'social',enabled:false,url:'https://example.com'}]}));
 assert.ok(!social.includes('<a '),'unsafe and disabled links must not render');
 const history=renderToStaticMarkup(React.createElement(m.CommitteeHistory,{members:[{id:1,name:'Historical',is_current:false,committee_year:2020},{id:2,name:'CurrentOnly',is_current:true,committee_year:2026}]}));
 assert.ok(history.includes('Committee of 2020'));
 assert.ok(!history.includes('CurrentOnly'),'current members must not leak into historical groups');
 assert.equal(renderToStaticMarkup(React.createElement(m.Carousel,{items:[{kind:'carousel',enabled:false,image_url:'https://example.com/a.png'}]})),'');
 console.log('PASS: HTTPS link validation, disabled/unsafe links, committee separation, hidden carousel');
} finally { await server.close(); }

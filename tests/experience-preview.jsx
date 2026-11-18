// Local-only component fixture: synthetic records, no Supabase client or mutations.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {LanguageProvider,LanguageToggle} from '../src/lib/i18n';
import {AboutSlideshow,AutoRail} from '../src/components/Experience';
import '../src/styles.css';
const picture=color=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="${color}"/></svg>`);
const slides=[{id:'one',kind:'about',key:'one',title:'First fixture image',enabled:true,display_order:1,image_url:picture('#176b52')},{id:'two',kind:'about',key:'two',title:'Second fixture image',enabled:true,display_order:2,image_url:picture('#344e8a')}];
createRoot(document.getElementById('root')).render(<LanguageProvider><main className="container"><h1>SMSA local component checks</h1><LanguageToggle/><AboutSlideshow items={slides}/><AutoRail label="Fixture batches">{Array.from({length:8},(_,i)=><button className="batch-card" key={i}>Dakhil-{2006+i}</button>)}</AutoRail></main></LanguageProvider>);

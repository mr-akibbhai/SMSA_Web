import {createContext,useContext,useEffect,useState} from 'react';
import bn from './translations.bn.json';
const LanguageContext=createContext({language:'en',t:key=>key});
export function translate(key,language='en') { return language==='bn' ? (bn[key] || key) : key; }
export function LanguageProvider({children}) {
 const [language,setLanguage]=useState(()=>{try{return localStorage.getItem('smsa-language')==='bn'?'bn':'en';}catch{return 'en';}});
 useEffect(()=>{document.documentElement.lang=language==='bn'?'bn':'en';try{localStorage.setItem('smsa-language',language);}catch{}},[language]);
 const t=key=>translate(key,language);
 return <LanguageContext.Provider value={{language,setLanguage,t}}>{children}</LanguageContext.Provider>;
}
export function useLanguage(){return useContext(LanguageContext);}
export function LanguageToggle(){const {language,setLanguage,t}=useLanguage();return <button className="language-toggle" aria-label={t("Switch language")} onClick={()=>setLanguage(language==='en'?'bn':'en')}>{language==='en'?'বাংলা':'English'}</button>;}
export function FormAccessibility(){
 const {t,language}=useLanguage();
 useEffect(()=>{
  function decorate(){document.querySelectorAll('input,select,textarea').forEach((field,index)=>{
   let label=field.closest('label') || (field.previousElementSibling?.tagName==='LABEL'?field.previousElementSibling:null);
   if(!label){if(field.placeholder)field.setAttribute("aria-label",field.placeholder);return;}
   if(field.required)label.dataset.required='true';else delete label.dataset.required;
   if(!field.id)field.id='smsa-field-'+index;
   label.htmlFor=field.id;
   if(!field.hasAttribute('aria-label') || field.dataset.autoLabel){field.dataset.autoLabel='true';field.setAttribute('aria-label',label.textContent.trim() || t('Field'));}
   if((!field.placeholder || field.dataset.autoPlaceholder) && ['text','email','password','tel','number'].includes(field.type)){field.dataset.autoPlaceholder='true';field.placeholder=label.textContent.trim() || t('Enter a value');}
  });}
  decorate();const observer=new MutationObserver(decorate);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();
 },[language]);
 return null;
}

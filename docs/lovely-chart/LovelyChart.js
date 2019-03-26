!function(){function t(t,e,n){const o=t,i=e,a=n;function c(t,e,n,i=1){const c=2*Math.pow(n,2),s=Math.floor(t.yMin/c)*c,l=Math.ceil(t.yMax/c)*c;o.textAlign="left",o.textBaseline="bottom",o.strokeStyle=N(t,"yAxisRulers",i),o.lineWidth=.5,o.beginPath();for(let n=s;n<=l;n+=c){const{yPx:c}=e.toPixels(0,n);if(c>a.height+u-g)continue;let s=i;c-u<=2*r&&(s=Math.min(1,i,(c-u)/(2*r))),o.fillStyle=N(t,"axesText",s),o.fillText(D(n),r,c-r/2),o.moveTo(r,c),o.lineTo(a.width-r,c)}o.stroke()}return{update:function(t,e){o.font=f,function(t,e){const n=a.height-g/2,c=Math.floor(t.xAxisScale),s=Math.pow(2,c),l=1-(t.xAxisScale-c);o.textAlign="center",o.textBaseline="middle";for(let c=Math.floor(t.labelFromIndex)-d;c<=t.labelToIndex+d;c++){if((c-x)%s!=0)continue;const d=i.xLabels[c];if(!d)continue;const{xPx:u}=e.toPixels(c,0);let f=(c-x)%(2*s)==0?1:l;const h=Math.min(u+r,a.width-u);h<=4*r&&(f=Math.min(1,f,h/(4*r))),o.fillStyle=N(t,"axesText",f),o.fillText(d.text,u,n)}}(t,e),function(t,e){const n=t.yAxisScale;if(n%1==0)c(t,e,n);else{const o=Math.floor(n);c(t,e,o,1-(n-o));const i=Math.ceil(n);c(t,e,i,1-(i-n))}}(t,e)}}}function e(t,e,n,o){const i=t*(o-n)/Math.floor(e/h);return Math.ceil(Math.log2(i))}function n(t,e,n){const o=t-g,i=(n-e)/Math.floor(o/m);return Math.ceil(Math.sqrt(i/2))}function o(t,{width:e,height:n}){const o=document.createElement("canvas");o.width=e*b,o.height=n*b,o.style.width="100%",o.style.height=`${n}px`;const i=o.getContext("2d");return i.scale(b,b),t.appendChild(o),{canvas:o,context:i}}function i(t,e){e.clearRect(0,0,t.width,t.height)}window.LovelyChart={create:function(f,h){const m=function(t){const{datasets:e}=function(t){const{columns:e,names:n,colors:o}=t;let i=[];const c=[];return e.forEach(t=>{const e=t.shift();e!==a?c.push({key:e,color:o[e],name:n[e],values:t}):function(t){for(let e=0,n=t.length;e<n;e++)if(void 0!==t[e]&&void 0!==t[e+1]&&t[e]>=t[e+1])throw new Error("Array is not sorted")}(i=t)}),c.forEach(t=>{t.labels=i}),{datasets:c}}(t);let n=1/0,o=-1/0;e.forEach(t=>{const{max:e}=W(t.values);0<n&&(n=0),e>o&&(o=e),t.yMin=0,t.yMax=e});const i=e.map(t=>t.labels[0]),c=e.map(t=>t.labels[t.labels.length-1]),s=Math.min.apply(null,i),r=Math.max.apply(null,c),l=function(t,e){t=O(t),e=O(e);const n=[];for(let o=t;o<=e;o+=L){const t=new Date(o),e=t.getDate(),i=E[t.getMonth()];n.push({value:o,text:`${i} ${e}`})}return n}(s,r);return{datasets:e,yMin:n,yMax:o,xLabels:l}}(h);let x,b,C,X,R,B,H;function q(){return{width:b.offsetWidth,height:b.offsetHeight}}function J(t){const e=P(t,function(){const{width:t,height:e}=q();return{width:t,height:e-g}}(),{xPadding:r,yPadding:u});i(b,C),X.update(t,e),function(t,e){const n={from:t.labelFromIndex-d,to:t.labelToIndex+d};m.datasets.forEach(({key:o,color:i,values:a})=>{const c={color:i,opacity:t[`opacity#${o}`],lineWidth:l};A(C,a,e,c,n)})}(t,e),B.update(t),H.update(t,e)}function G(t){R.update({range:t})}function z(t){R.update({filter:t})}return function(t){(x=document.createElement("div")).className="lovely-chart",document.getElementById(t).appendChild(x)}(f),function(){const{canvas:t,context:e}=o(x,{width:x.clientWidth,height:x.clientWidth*s});b=t,C=e}(),X=t(C,m,q()),R=function(t,o,i){const a=t,c=o,s=i,r={begin:0,end:1},l=function(){const t={};return a.datasets.forEach(({key:e})=>{t[e]=!0}),t}(),d=S([T,a.datasets.map(({key:t})=>`opacity#${t}`)]),u=function(t){const e=t,n={};let o=null;function i(t){delete n[t],a()||(cancelAnimationFrame(o),o=null)}function a(){return Boolean(Object.keys(n).length)}function c(){const t={};Object.keys(n).forEach(e=>{const{startedAt:o,from:a,to:c}=n[e],s=Math.min(1,(Date.now()-o)/k),r=a+(c-a)*function(t){return Math.sin(Math.PI/2*t)}(s);n[e].current=r,t[e]=r,1===s&&i(e)}),e(t),a()&&(o=requestAnimationFrame(c))}return{add:function(t,e,i){n[t]={from:e,to:i,current:e,startedAt:Date.now()},o||(o=requestAnimationFrame(c))},remove:i,get:function(t){return n[t]},getState:function(){const t={};return Object.keys(n).forEach(e=>{t[e]=n[e].current}),t},isRunning:a}}(m),f=F(m);let h={};function m(){s({...h,...u.getState()})}return{update:function({range:t={},filter:o={}}={}){Object.assign(r,t),Object.assign(l,o);const i=h;h=function(t,o,i,a,c){const{begin:s,end:r}=i,l=t.xLabels.length-1,d=Math.max(0,Math.ceil(l*s)),u=Math.min(l,Math.floor(l*r)),f=t.datasets.filter(({key:t})=>a[t]).map(({values:t})=>t),h=f.map(t=>t.slice(d,u+1)),{max:m=c.yMaxFiltered}=W(S(f)),{max:g=c.yMax}=W(S(h)),x={};return t.datasets.forEach(({key:t})=>{x[`opacity#${t}`]=a[t]?1:0}),{xOffset:s*l,xWidth:(r-s)*l,yMinFiltered:0,yMaxFiltered:m,yMin:0,yMax:g,xAxisScale:e(t.xLabels.length,o.width,s,r),yAxisScale:n(o.height,0,g),labelFromIndex:d,labelToIndex:u,...x,...j(),...i,filter:a}}(a,c,r,l,i),d.forEach(t=>{const e=u.get(t),n=e?e.to:i[t];if(void 0!==n&&n!==h[t]){const n=e?e.current:i[t];e&&u.remove(t),u.add(t,n,h[t])}}),u.isRunning()||f()}}}(m,q(),J),B=function(t,e,n){const a=t,s=e,r=n;let l,d,u,f,h,m,g,x={},b=null;const L=F(function(){const{begin:t,end:e}=x;f.children[0].style.width=`${100*t}%`,f.children[1].style.width=`${100*(e-t)}%`,f.children[2].style.width=`${100*(1-e)}%`});function E(t){m=t.target.offsetLeft}function w(t,e,{dragOffsetX:n}){const o=d.offsetWidth,i=o-h.offsetWidth,a=Math.max(0,Math.min(m+n,i)),c=a+h.offsetWidth,s=a/o,r=c/o;C({begin:s,end:r})}function $(t,e,{dragOffsetX:n}){const o=d.offsetWidth,i=h.offsetLeft+h.offsetWidth-2*v,a=Math.min(i,Math.max(0,m+n)),c=a/o;C({begin:c})}function k(t,e,{dragOffsetX:n}){const o=d.offsetWidth,i=h.offsetLeft+2*v,a=o,c=Math.max(i,Math.min(m+v+n,a)),s=c/o;C({end:s})}function C(t){const e=Object.assign({},x,t);e.begin===x.begin&&e.end===x.end||(x=e,L(),r(x),b&&(clearTimeout(b),b=null),b=setTimeout(()=>{r(x)},50))}return(l=document.createElement("div")).className="minimap",l.style.height=`${y}px`,function(){const{canvas:t,context:e}=o(l,{width:a.offsetWidth-2*p,height:y});d=t,u=e}(),(f=document.createElement("div")).className="ruler",f.innerHTML=M,I(h=f.children[1],{onCapture:E,onDrag:w,draggingCursor:"grabbing"}),I(h.children[0],{onCapture:E,onDrag:$,draggingCursor:"ew-resize"}),I(h.children[1],{onCapture:E,onDrag:k,draggingCursor:"ew-resize"}),l.appendChild(f),a.appendChild(l),C(c),{update:function(t){(function(t){if(!g)return!0;const e=s.datasets.map(({key:t})=>`opacity#${t}`);return e.push("yMaxFiltered"),e.some(e=>g[e]!==t[e])})(t)&&(g=t,i(d,u),function(t={}){const e={width:d.offsetWidth,height:d.offsetHeight};s.datasets.forEach(({key:n,color:o,values:i})=>{const a=t[`opacity#${n}`],c=0===t.yMinFiltered&&2===s.datasets.length&&function(t,e){if(t.filter){const n=t[`opacity#${e}`],o=Object.values(t.filter).filter(t=>!0===t).length,i=t.filter[e],a=i?o>1:o>0;return n<1&&a}return!1}(t,n),r={xOffset:0,xWidth:s.xLabels.length,yMin:c?s.yMin:t.yMinFiltered,yMax:c?s.yMax:t.yMaxFiltered},l=P(r,e,{yPadding:1}),d={color:o,opacity:a,lineWidth:1};A(u,i,l,d)})}(t))}}}(x,m,G),H=function(t,e,n){const a=t,c=e,s=n;let r,l,d,u,f,h,m;const x=F(v);function y(t){m="touchmove"===t.type?t.touches[0].pageX-function(t){let e=t.offsetLeft;for(;t=t.parentNode&&t.offsetLeft;)e+=t.offsetLeft;return e}(t.touches[0].target):t.offsetX,x()}function p(t){t&&t.preventDefault(),m=null,i(u,f),h.classList.remove("shown")}function v(){if(!m||!r)return;const t=m,e=r,{findClosesLabelIndex:n,toPixels:o}=l,a=n(t);if(a<0||a>=c.xLabels.length)return;i(u,f);const{xPx:d}=o(a,0);!function(t,e,n){f.strokeStyle=n,f.lineWidth=1,f.beginPath(),f.moveTo(t,0),f.lineTo(t,e),f.stroke()}(d,s.height-g,N(e,"tooltipTail"));const x=c.datasets.filter(({key:t})=>e.filter[t]).map(({name:t,color:e,values:n})=>({name:t,color:e,value:n[a]}));x.forEach(({value:t,color:n})=>{!function({xPx:t,yPx:e},n,o){f.strokeStyle=n,f.fillStyle=o,f.lineWidth=2,f.beginPath(),f.arc(t,e,4,0,2*Math.PI),f.fill(),f.stroke()}(o(a,t),n,N(e,"bg"))}),function(t,e,n){const o=c.xLabels[n],i=new Date(o.value);h.children[0].innerHTML=`${w[i.getDay()]}, ${o.text}`,h.children[1].innerHTML=t.map(({name:t,color:e,value:n})=>`<div class="dataset" style="color: ${e}"><div>${D(n,2)}</div><div>${t}</div></div>`).join("");const a=Math.max($,Math.min(e,s.width-h.offsetWidth+$));h.style.left=`${a}px`,h.classList.add("shown")}(x,d,a)}return(d=document.createElement("div")).className="tooltip",function(){const{canvas:t,context:e}=o(d,s);u=t,f=e}(),(h=document.createElement("div")).className="balloon",h.innerHTML='<div class="title"></div><div class="legend"></div>',d.appendChild(h),d.addEventListener("mousemove",y),d.addEventListener("touchmove",y),d.addEventListener("mouseout",p),d.addEventListener("mouseup",p),d.addEventListener("touchend",p),d.addEventListener("touchcancel",p),a.appendChild(d),{update:function(t,e){r=t,l=e,v()}}}(x,m,q()),function(t,e,n){const o=t,i=e,a=n;let c;function s(t){t&&(t.preventDefault(),t.currentTarget.classList.toggle("checked"));const e={};Array.from(c.getElementsByTagName("a")).forEach(t=>{e[t.dataset.key]=t.classList.contains("checked")}),a(e)}(c=document.createElement("div")).className="tools",i.datasets.forEach(({key:t,name:e,color:n})=>{const o=document.createElement("a");o.href="#",o.dataset.key=t,o.className="checkbox checked",o.innerHTML=`<span class="circle"></span><span class="label">${e}</span>`,o.firstChild.style.borderColor=n,o.addEventListener("click",s),c.appendChild(o)}),o.appendChild(c),s()}(x,m,z),{redraw:function(){R.update()}}}};const a="x",c={begin:.333,end:.667},s=.9,r=10,l=2,d=10,u=10,f="300 10px Helvetica, Arial, sans-serif",h=45,m=50,g=30,x=1,y=40,p=10,v=5,M='<div class="mask"></div><div class="slider"><div></div><div></div></div><div class="mask"></div>',b=window.devicePixelRatio||1,L=864e5,E=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],w=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],$=20,k=300,C={day:{bg:[255,255,255],axesText:[150,162,170],yAxisRulers:[242,244,245],tooltipTail:[223,230,235]},night:{bg:[36,47,62],axesText:[84,103,120],yAxisRulers:[41,53,68],tooltipTail:[59,74,90]}},T=["yMax","xAxisScale","yAxisScale","yMaxFiltered",...S(Object.keys(C.day).map(t=>["R","G","B"].map(e=>`colorChannels#${t}#${e}`)))];function P(t,e,{xPadding:n=0,yPadding:o=0}={}){let i=e.width;0===t.begin&&(i-=n),1===t.end&&(i-=n);const a=i/t.xWidth;let c=t.xOffset*a;0===t.begin&&(c-=n);const s=(e.height-o)/(t.yMax-t.yMin),r=t.yMin*s;return{toPixels:(t,n)=>({xPx:t*a-c,yPx:e.height-(n*s-r)}),findClosesLabelIndex:t=>Math.round((t+c)/a)}}function A(t,e,n,o,i){const{from:a=0,to:c=e.length}=i||{};t.save(),t.strokeStyle=o.color,t.lineWidth=o.lineWidth,t.globalAlpha=o.opacity,t.lineJoin="round",t.beginPath();for(let o=a;o<=c;o++){const{xPx:i,yPx:a}=n.toPixels(o,e[o]);0===o?t.moveTo(i,a):t.lineTo(i,a)}t.stroke(),t.restore()}function W(t){const e=t.length;let n=t[0],o=t[0];for(let i=0;i<e;i++){const e=t[i];e>n?n=e:e<o&&(o=e)}return{max:n,min:o}}function S(t){return[].concat.apply([],t)}function F(t){let e=!1;return function(){e||(e=!0,requestAnimationFrame(()=>{e=!1,t()}))}}function O(t){return t-t%L}function D(t,e=1){return t>=1e6?X(t/1e6,e)+"M":t>=1e3?X(t/1e3,e)+"K":t}function X(t,e){return t.toFixed(e).replace(/(\d{3,})\.\d+/,"$1").replace(/\.0+$/,"")}function I(t,e){let n=null;function o(o){o.target===t&&(o.preventDefault(),n=o,"mousedown"===o.type?(document.addEventListener("mousemove",a),document.addEventListener("mouseup",i)):"touchstart"===o.type&&(document.addEventListener("touchmove",a),document.addEventListener("touchend",i),document.addEventListener("touchcancel",i),void 0===o.pageX&&(o.pageX=o.touches[0].pageX)),e.draggingCursor&&document.body.classList.add(`cursor-${e.draggingCursor}`),e.onCapture&&e.onCapture(o))}function i(){n&&(e.draggingCursor&&document.body.classList.remove(`cursor-${e.draggingCursor}`),document.removeEventListener("mouseup",i),document.removeEventListener("mousemove",a),document.removeEventListener("touchcancel",i),document.removeEventListener("touchend",i),document.removeEventListener("touchmove",a),n=null)}function a(t){n&&("touchmove"===t.type&&void 0===t.pageX&&(t.pageX=t.touches[0].pageX),e.onDrag(t,n,{dragOffsetX:t.pageX-n.pageX}))}t.addEventListener("mousedown",o),t.addEventListener("touchstart",o)}function j(){const t={};return Object.keys(C.day).forEach(e=>{["R","G","B"].forEach((n,o)=>{t[`colorChannels#${e}#${n}`]=C[document.body.classList.contains("skin-night")?"night":"day"][e][o]})}),t}function N(t,e,n=1){return function([t,e,n],o=1){return`rgba(${t}, ${e}, ${n}, ${o})`}(function(t,e){return["R","G","B"].map(n=>Math.round(t[`colorChannels#${e}#${n}`]))}(t,e),n)}}();
const DATA_SOURCES=["data/1","data/2","data/3","data/4","data/5"];let snow,charts=[];document.addEventListener("DOMContentLoaded",()=>{DATA_SOURCES.forEach(a=>{charts.push(LovelyChart.create("container",{dataSource:a}))}),fetch("./data/chart_data.json").then(a=>a.json()).then(a=>{a.forEach(a=>charts.push(LovelyChart.create("container",a)))}),document.getElementById("skin-switcher").addEventListener("click",a=>{a.preventDefault(),document.body.classList.toggle("skin-night"),a.target.innerText=`Switch to ${document.body.classList.contains("skin-night")?"Day":"Night"} Mode`,charts.forEach(a=>{a.redraw()})}),document.getElementById("killer-feature").addEventListener("click",a=>{if(a.preventDefault(),a.currentTarget.classList.toggle("checked"),!snow){snow=document.createElement("div");let a="";for(let b=0;12>b;b++)a+="<div class=\"flake\">\u2744\uFE0F</div>";snow.innerHTML=a}snow.parentNode?document.body.removeChild(snow):document.body.appendChild(snow)})});
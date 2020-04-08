// 观察者（发布订阅）
class Dep{
    constructor(){
        this.subs = []; //存放所有watcher
    }
    //添加Watcher，订阅
    addSub(watcher){
        this.subs.push(watcher);
    }
    //发布，调用watcher中的update()方法
    notify(){
        //每次通知，都调用Watcher的update()方法
        this.subs.forEach(watcher=>watcher.update());
    }
}
class Watcher{
    constructor(vm,expr,cb){
        this.vm = vm;
        this.expr = expr;
        this.cb = cb;
        // 默认先存放一个旧值
        this.oldValue = this.get();
    }
    get(){
        //获取旧值的同时把观察者实例放到Dep订阅数组中
        Dep.target = this;//this ==> 观察者实例
        //取值，把观察者和
        let value = CompileUtil.getVal(this.vm,this.expr);
        Dep.target = null;
        return value;
    }
    //更新操作 数据变化后，会调用watcher的update方法
    update(){
        let newVal = CompileUtil.getVal(this.vm,this.expr);
        if(newVal !== this.oldValue){
            this.cb(newVal);
        }
    }
}
// vm.$watch(vm,'school.name',(newVal)=>{})
//实现数据劫持功能，里面的方法是vm.$data里面的数据一变就马上执行并观察
class Observer{
    constructor(data){
        // console.log(data)
        this.observer(data);
    }
    //用defineProperty监测值的读写
    observer(data){
        //如果是对象才观察
        if(data && typeof data == 'object'){
            //遍历对象
            for(let key in data){
                this.defineReactive(data,key,data[key]);
            }
        }
    }
    defineReactive(obj,key,value){
        //执行observer原因是如果value是对象，则需要再次遍历，再能观察到对象里面的属性和属性值
        this.observer(value);
        let _this = this;
        let dep = new Dep();//给每一个属性都加上一个具有发布订阅功能
        // 通过Object.defineProperty()将value转换为getter和setter
        Object.defineProperty(obj,key,{
            get(){
                //创建watcher时，会取到对应的内容，并且把watcher
                //触发get的时候将观察者放入订阅数组中
                Dep.target && dep.addSub(Dep.target);
                return value;
            },
            set(newVal){
                //如果新值和旧值相同，则不需要执行赋值
                if(newVal != value){
                    //修改值之后调用observer方法，把新的值放进去，将里面的数据也转化为get和set
                    _this.observer(newVal);
                    value = newVal;
                    //让Dep中存着的观察者依次执行
                    dep.notify();
                }
            }
        })
    }
}
//编译
class Compiler{
    constructor(el,vm){//vm就是Vue实例
        // 判断el属性是否是一个dom元素，如果不是，就获取dom
        this.el = this.isElementNode(el)?el:document.querySelector(el);
        //把页面中的真实元素获取到，并放到内存中
        let fragment = this.node2fragment(this.el);   
        // console.log(fragment);
        this.vm = vm;

        //把节点中的内容进行替换

        //编译模板 把数据和虚拟节点结合
        this.compile(fragment);

        //把虚拟节点（包含了数据）替换真实的dom节点
        this.el.appendChild(fragment);
    }
    //判断属性名是否以v-开头，找到v-指令
    isV(attrName){
        return attrName.startsWith('v-');
    }
    //编译元素
    compileElement(node){ 
        let attributes = node.attributes; //类数组，标签的属性
        [...attributes].forEach(attr=>{
            // console.log(attr);//type='text',v-model='school.name'
            let {name,value:expr} = attr;
            // console.log(name,value);
            if(this.isV(name)){//判断元素的属性是否有'v-'开头的attribute
                let [,directive] = name.split('-'); //directive=='model'
                //根据不同的v-指令执行不同的处理方法
                CompileUtil[directive](node,expr,this.vm)
                // console.log('element',node);
            }
        })
    }
    //编译文本
    compileText(node){//判断当前文本节点中内容是否包含 {{}}
        let content = node.textContent;
        // console.log(content);
        //用正则判断是否有{{}}
        if(/\{\{(.+?)\}\}/.test(content)){
            // console.log(content); //{{school.name}}{{school.age}}
            CompileUtil['text'](node,content,this.vm)
            // console.log(content);
        }
    }
    //用来编辑内存中的dom节点，把dom和数据结合，核心的编译
    compile(node){
        let childNodes = node.childNodes;
        // console.log(childNodes);
        [...childNodes].forEach(child=>{
            if(this.isElementNode(child)){//如果是元素节点，则执行...
                // console.log('node',child);
                this.compileElement(child);
                //如果是dom元素，则需要把自己传进去，因为要找到最内层是否有{{}}
                this.compile(child);
            }else{//如果不是元素节点，则执行...
                // console.log('text',child);
                this.compileText(child);
            }
        })
    }
    //把节点移动到内存中（获取#app中所有节点）
    node2fragment(node){
        //创建虚拟节点对象
        let fragment = document.createDocumentFragment();
        let firstChild;
        while(firstChild = node.firstChild){
            //appendChild() 具有移动性
            //虚拟节点每appendChild一次，真实dom就少一个节点，所以这里最后页面上的真实节点都被拿没了，页面没东西了
            fragment.appendChild(firstChild);
        }
        return fragment;
    }
    isElementNode(node){
        //是不是元素节点 nodeType判断node是否是元素节点
        return node.nodeType == 1;
    }
}
CompileUtil = {
    //拿到data中的某个属性值
    getVal(vm,expr){//expr == 'school.name' split('.')==>[school,name]
        return expr.split('.').reduce((data,current)=>{
            return data[current]; // data.school,data.school.name
        },vm.$data);
    },
    model(node,expr,vm){//node是节点，expr是attribute的值，vm是vue实例
        //去vm中找到data.school.name...
        // 输入框赋予初始的value属性
        let fn = this.updater['modelUpdater']
        //一开始创建Vue实例的时候，给输入框加一个观察者，后面数据更新了会触发观察者的回调函数，从而触发fn()，会拿新值赋给输入框的value
        //
        new Watcher(vm,expr,(newVal)=>{
            fn(node,newVal);
        })
        let value = this.getVal(vm,expr);
        // console.log(value); //'珠峰'
        fn(node,value);
    },
    html(){

    },
    getContentValue(vm,expr){
        //用'珠峰'替换页面的'{{school.name}}'
        return expr.replace(/\{\{(.+?)\}\}/g,(...args)=>{
            return this.getVal(vm,args[1]);
        })
    },
    text(node,expr,vm){
        //expr == {{school.name}}和{{school.age}}
        let fn = this.updater['textUpdater'];
        //这段不懂
        let content = expr.replace(/\{\{(.+?)\}\}/g,(...args)=>{
            // console.log(args);
            // args === ['{{school.name}}','school.name','0','{{school.name}}']
            new Watcher(vm,args[1],(newVal)=>{
                fn(node,this.getContentValue(vm,expr)); //返回了一个全的字符串
            })
            return this.getVal(vm,args[1]);
        })
        fn(node,content);
    },
    updater:{
        //把数据插入到带有v-model属性的input标签中
        modelUpdater(node,value){
            node.value = value;
        },
        htmlUpdater(){

        },
        //处理文本节点
        textUpdater(node,value){
            node.textContent = value;
        }
    }
}
class Vue{
    constructor(options){
        this.$el = options.el;
        this.$data = options.data;
        //这个根元素存在，编译模板
        if(this.$el){
            //把数据 全部转化成Object.defineProperty()来定义
            new Observer(this.$data);
            // console.log(this.$data);
            new Compiler(this.$el,this);
        }
    }
}
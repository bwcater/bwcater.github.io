Vue.createApp({
 data() {
    return {
       reflections: [],
       selectedReflection: [],
       jsonFile: '../../json/reflections.json',
       totalReflections: 0,
       reflectionId: 0,
    }
},
    methods: {  
        getSelected() {
            var urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('pid')) {
                this.reflectionId = ((urlParams.get('pid')*1));
                this.selectedReflection = this.reflections.splice(this.reflectionId,1);
            }
        },
        getNext() {
            if ((this.reflectionId + 1) < this.totalReflections) {
                this.openReflection((this.reflectionId *1)+1);
            }
        },
        openReflection(index) {
            window.location.href = `reflection.html?pid=${index}#Reflections`;
        },
        getPrevious() {
            if ((this.reflectionId <= this.totalReflections)  && this.reflectionId > -1) {
                this.openReflection((this.reflectionId*1)-1);
            }
        },
        isTimeToShowIt(showOnDate) {
            if (showOnDate == null) return true;

            let currentDate = new Date();
            let showDate = new Date(showOnDate);

            console.log('curr: ' + currentDate, ' showDate: ' + showDate);
            
            if (showDate <= currentDate) {
                return true;
            } else {
                return false;
            }
        }
    },
    computed: {
    },
    watch: {
    },
    mounted() {
        axios.get(this.jsonFile)
        .then((response) => {
             this.reflections = response.data.entries;
             this.totalReflections = this.reflections.length;
             this.getSelected();
        })
    }
}).mount('.reflections-content');
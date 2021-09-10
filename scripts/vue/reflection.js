Vue.createApp({
 data() {
    return {
       reflections: [],
       selectedReflection: [],
       jsonFile: '../../json/reflections.json',
       totalReflections: 0,
       reflectionId: 0,
       selectedRecord: [],
       index: 0
    }
},
    methods: {  
        getSelected() {
            var urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('pid')) {
                this.reflectionId = ((urlParams.get('pid')*1));
                this.selectedRecord = this.reflections.find(r => r.id == this.reflectionId);
                document.querySelector('meta[name="description"]').content = this.selectedRecord.description;
            } else {
                document.querySelector('meta[name="description"]').content = "Wayne Cater's Blog";
                return [];
            }
        },
        getNext() {
            if ((this.reflectionId + 1) <= this.totalReflections) {
                let entry = this.reflections.find(r => r.id == (this.reflectionId + 1));

                if (!entry || !entry.show) {
                    this.reflectionId++;
                    this.getNext();
                } else {
                    this.openReflection((this.reflectionId *1)+1);
                }
            }
        },
        openReflection(index) {
            window.location.href = `reflection.html?pid=${index}`;
        },
        getPrevious() {
            
            if (this.reflectionId > -1) {
                let entry = this.reflections.find(r => r.id == (this.reflectionId - 1));
                
                if (!entry || !entry.show) {
                    this.reflectionId--;
                    this.getPrevious();
                } else {
                    this.openReflection((this.reflectionId*1)-1);
                }
            }
        },
        isTimeToShowIt(showOnDate) {
            if (showOnDate == null) return true;

            let currentDate = new Date();
            let showDate = new Date(showOnDate);

            if (showDate <= currentDate) {
                return true;
            } else {
                return false;
            }
        }
    },
    computed: {
        openLastPage() {
            this.openReflection(this.reflections.length);
        },
        getRecord() {
            this.reflectionId = this.selectedRecord.id;
            return this.selectedRecord;
        }
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
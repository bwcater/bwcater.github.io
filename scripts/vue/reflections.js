Vue.createApp({
 data() {
    return {
       reflections: [],
       pages: [],
       postsPerPage: 3,
       page: 1,
       jsonFile: '../../json/reflections.json',
       currentReflection: []
    }
},
    methods: {
        setPage () {
            let numberOfPages = Math.ceil(this.reflections.length / this.postsPerPage);
            for (let index = 1; index <= numberOfPages; index++) {
              this.pages.push(index);
            }
        },
        paginate (reflections) {
            let page = this.page;
            let perPage = this.postsPerPage;
            let from = (page * perPage) - perPage;
            let to = (page * perPage);
            return  reflections.slice(from, to);
        },
        openReflection(page) {
            window.location.href = `reflection.html?pid=${page}`;  //#Reflections`;
        },
        loadReflection(page) {
            index = (page*1);
            this.currentReflection = this.reflections[index];
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
        displayedPosts () {
            return this.paginate(this.reflections);
        },
        lastPage() {
            return Math.ceil(this.reflections.length / this.postsPerPage)
        }
    },
    watch: {
        reflections() {
            this.setPage();
        }
    },
    mounted() {
        axios.get(this.jsonFile)
        .then((response) => {
            this.reflections  = response.data.entries.filter( (row) => {
                return this.isTimeToShowIt(row.showOnDate) && row.show;
            });
        })

        var urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('pid')) {
            let reflectionId = urlParams.get('pid');
            this.loadReflection(reflectionId*1);
        }
    }
}).mount('.reflections-content');
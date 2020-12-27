Vue.createApp({
 data() {
    return {
       reflections: [],
       pages: [],
       postsPerPage: 4,
       page: 1,
       //jsonFile: 'http://localhost:3000/json/reflections.json',
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
        openReflection(index) {
            window.location.href = `reflection.html?pid=${index}#Reflections`;
        },
        loadReflection(index) {
            this.currentReflection = this.reflections[index];
        }
    },
    computed: {
        displayedPosts () {
            return this.paginate(this.reflections);
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
            this.reflections = response.data;
        })

        var urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('pid')) {
            let reflectionId = urlParams.get('pid');
            this.loadReflection(reflectionId*1);
        }
    }
}).mount('.reflections-content');
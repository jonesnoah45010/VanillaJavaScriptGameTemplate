// This is is used in index.html tab navigation
document.addEventListener("DOMContentLoaded", function () {
    const tabs = document.querySelectorAll(".nav-tab");
    const contents = document.querySelectorAll(".tab-content");
    tabs.forEach(tab => {
        tab.addEventListener("click", function (event) {
            event.preventDefault();
            tabs.forEach(t => t.classList.remove("active"));
            this.classList.add("active");
            contents.forEach(content => content.classList.remove("active-content"));
            const targetId = this.getAttribute("data-tab");
            document.getElementById(targetId).classList.add("active-content");
        });
    });

});


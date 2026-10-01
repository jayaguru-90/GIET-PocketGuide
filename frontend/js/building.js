/* =====================================================
   BUILDING SEARCH
===================================================== */

const searchInput = document.getElementById("buildingSearch");

const buildingCards = document.querySelectorAll(".building-card");


searchInput.addEventListener("input", function () {

    const searchValue =
        this.value.toLowerCase().trim();


    buildingCards.forEach(function (card) {

        const buildingName =
            card.innerText.toLowerCase();


        if (buildingName.includes(searchValue)) {

            card.style.display = "flex";

        } else {

            card.style.display = "none";

        }

    });

});


/* =====================================================
   OPEN BUILDING LAYOUT
===================================================== */

function openLayout(buildingName) {

    const modal =
        document.getElementById("layoutModal");

    const title =
        document.getElementById("modalTitle");

    const description =
        document.getElementById("modalDescription");


    title.innerText =
        buildingName + " — Floor Layout";


    description.innerText =
        "Select a floor to explore the rooms, laboratories, classrooms and facilities inside this building.";


    modal.classList.add("active");

}


/* =====================================================
   CLOSE LAYOUT
===================================================== */

function closeLayout() {

    const modal =
        document.getElementById("layoutModal");

    modal.classList.remove("active");

}


/* =====================================================
   SELECT FLOOR
===================================================== */

function selectFloor(floorNumber) {

    const description =
        document.getElementById("modalDescription");


    const floorNames = {

        1: "Ground Floor",

        2: "First Floor",

        3: "Second Floor",

        4: "Third Floor"

    };


    description.innerText =
        "Showing " +
        floorNames[floorNumber] +
        " layout.";
}


/* =====================================================
   CLOSE MODAL WHEN CLICKING OUTSIDE
===================================================== */

document
    .getElementById("layoutModal")
    .addEventListener("click", function (event) {

        if (event.target === this) {

            closeLayout();

        }

    });


/* =====================================================
   ESC KEY
===================================================== */

document.addEventListener("keydown", function (event) {

    if (event.key === "Escape") {

        closeLayout();

    }

});
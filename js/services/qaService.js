// js/services/qaService.js

const qaService = (() => {

    const state = {
        page: "dashboard",
        role: "admin",
        drawerOpen: false,
        modalOpen: false,
        currentGame: null,
        currentAssignment: null,
        lastAction: null,
        errors: []
    };

    function setPage(page) {
        state.page = page;
    }

    function setRole(role) {
        state.role = role;
    }

    function openDrawer(gameId = null) {
        state.drawerOpen = true;
        state.currentGame = gameId;
    }

    function closeDrawer() {
        state.drawerOpen = false;
        state.currentGame = null;
    }

    function openModal(name = "") {
        state.modalOpen = true;
        state.lastAction = `modal:${name}`;
    }

    function closeModal() {
        state.modalOpen = false;
    }

    function setAssignment(id) {
        state.currentAssignment = id;
    }

    function logAction(action) {
        state.lastAction = action;
    }

    function logError(error) {
        state.errors.push({
            time: new Date().toISOString(),
            message: String(error)
        });
    }

    function clearErrors() {
        state.errors = [];
    }

    function getState() {
        return {
            page: state.page,
            role: state.role,

            drawerOpen: state.drawerOpen,
            modalOpen: state.modalOpen,

            currentGame: state.currentGame,
            currentAssignment: state.currentAssignment,

            lastAction: state.lastAction,

            games:
                typeof gameService !== "undefined"
                    ? gameService.getAll().length
                    : 0,

            crew:
                typeof crewService !== "undefined"
                    ? crewService.getAll().length
                    : 0,

            errors: [...state.errors]
        };
    }

    return {
        setPage,
        setRole,

        openDrawer,
        closeDrawer,

        openModal,
        closeModal,

        setAssignment,

        logAction,

        logError,
        clearErrors,

        getState
    };

})();

window.qaService = qaService;
class GBGMap {
    constructor() {
        /**
         * The provinces in this map.
         * @type {{string: Province}}
         */
        this.provinces = {};
    }

    // Must be overridden by subclasses
    /**
     * Converts a province id to its name.
     * This is primarily possible because province names follow a pretty strict pattern.
     * @param id {number} The id to convert
     * @return {string} The name of the province associated with the given id
     */
    idToName(id) {}
}
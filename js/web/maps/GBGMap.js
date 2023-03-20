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
     * Whether the names of provinces are the same every season (assuming the same map) is unknown,
     * but I am pretty certain they are as the server does not inform the client of province names.
     * @param id {number} The id to convert
     * @return {string} The name of the province associated with the given id
     */
    idToName(id) {}
}
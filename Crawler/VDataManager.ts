import * as Excel from 'exceljs';
import HashMap = require("hashmap");
import * as SS from "./VStaticStrings";
import { Vasync } from "./async";

export enum VEDataType {
    KEEP_OLD,
    DOWN_PRIZE,
    UP_PRIZE,
    SELLED,
    DISAPPER,
}

export class VHouse {
    url: string;
    cellname: string;
    region: string;
    prize: number;
    size: number;
    floorAndYear: string;
    circleRegion: string;
    shapeURI: string;

    constructor() {

    }
}

export class VDataManager {
    datas: HashMap<string, [VHouse, VEDataType]>;

    constructor() {
        this.datas = new HashMap<string, [VHouse, VEDataType]>();
    }

    loadFromExcel(done: () => void) {

    }

    saveToExcel(done: () => void) {

    }
}
import * as Excel from 'exceljs';
import HashMap = require("hashmap");
import * as SS from "./VStaticStrings";
import { Vasync } from "./async";

export enum VESchoolLevel {
    LEVEL1,
    LEVEL2,
    OTHER,
}

export class VSchool {
    name: string;
    //level: VESchoolLevel;

    constructor(n: string = "unknown") {//, l: VESchoolLevel = VESchoolLevel.OTHER) {
        this.name = n;
        //this.level = l;
    }
}

export class VMetroNearCell {
    constructor(public name: string, public lineDis: number, public walkDis: number, public walkDur: number) {}
}

export class VInfoManager {
    primaryMap: HashMap<string, VSchool>; // static
    juniorMap: HashMap<string, VSchool>; // static
    metroMap: HashMap<string, Array<VMetroNearCell>>;

    private metrofile: string;

    constructor(done: () => void) {
        this.primaryMap = new HashMap<string, VSchool>();
        this.juniorMap = new HashMap<string, VSchool>();
        this.metroMap = new HashMap<string, Array<VMetroNearCell>>();
        this.metrofile = "metro_info.xlsx";

        let waits = Vasync.createAWaitAll(2, done);

        this.loadSchoolFromExcel(() => {
            waits[0].FinishFunc();
        });

        this.loadMetroCellFromExcel(() => {
            waits[1].FinishFunc();
        });
    }

    SaveMetroCells(done: () => void) {
        let workbook = new Excel.Workbook();
        let sheet = workbook.addWorksheet("Sheet1");
        sheet.addRow(["小区", "地铁站", "直线距离(m)", "步行距离(m)", "步行时间(s)"]);

        this.metroMap.forEach((val: Array<VMetroNearCell>, key: string) => {
            for (let i = 0; i < val.length; i++) {
                sheet.addRow([key, val[i].name, val[i].lineDis, val[i].walkDis, val[i].walkDur]);
            }
        });

        workbook.xlsx.writeFile(SS.OneDriveHouseFolder + this.metrofile).then(done);
    }

    private loadSchoolFromExcel(done: () => void) {
        let waits = Vasync.createAWaitAll(2, done);

        this.readAndMarkFromExcel("pudong_xiaoxue.xlsx", this.primaryMap, () => {
            this.readAndMarkFromExcel("xuhui_xiaoxue.xlsx", this.primaryMap, () => {
                waits[0].FinishFunc();
            });
        });

        this.readAndMarkFromExcel("pudong_zhongxue.xlsx", this.juniorMap, () => {
            waits[1].FinishFunc();
        });
    }

    private readAndMarkFromExcel(file: string, map: HashMap<string, VSchool>, done: () => void) {
        let workbook = new Excel.Workbook();
        workbook.xlsx.readFile(SS.OneDriveHouseFolder + file).then(() => {
            let sheet = workbook.getWorksheet("Sheet1");
            for (let i = 2; i <= sheet.rowCount; i++) {
                let row = sheet.getRow(i);
                if (row.getCell(4).value) {
                    let schoolName = row.getCell(4).value.toString();

                    let address = row.getCell(6).value ? row.getCell(6).value.toString() : "";
                    if (address != "" && !map.has(address)) {
                        map.set(address, new VSchool(schoolName));
                    }

                    let cell = row.getCell(7).value ? row.getCell(7).value.toString() : "";
                    if (cell != "" && !map.has(cell)) {
                        map.set(address, new VSchool(schoolName));
                    }
                } else {
                    console.log("line " + i + " name error. file name : " + file);
                }
            }

            done();
        }).catch(() => {
            console.log("ERR : " + file + " not exist.");
            done();
        });
    }

    private loadMetroCellFromExcel(done: () => void) {
        let workbook = new Excel.Workbook();
        workbook.xlsx.readFile(SS.OneDriveHouseFolder + this.metrofile).then(() => {
            // read
            let sheet = workbook.getWorksheet("Sheet1");
            for (let i = 2; i <= sheet.rowCount; i++) {
                let row = sheet.getRow(i);
                let cellName = row.getCell(1).value.toString();
                let metroName = row.getCell(2).value.toString();
                let lineDis = Number(row.getCell(3).value.toString());
                let walkDis = Number(row.getCell(4).value.toString());
                let walkDur = Number(row.getCell(5).value.toString());
                this.AddMetroInfo(cellName, new VMetroNearCell(metroName, lineDis, walkDis, walkDur));
            }
            done();
        }).catch(() => {
            done();
        });
    }

    AddMetroInfo(cellName: string, info: VMetroNearCell) {
        if (!this.metroMap.has(cellName)) {
            this.metroMap.set(cellName, new Array<VMetroNearCell>());
        } 
        this.metroMap.get(cellName).push(info);
    }
}

export default VInfoManager;

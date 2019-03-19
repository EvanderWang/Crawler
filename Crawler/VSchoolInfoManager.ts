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

export class VSchoolInfoManager {
    primaryMap: HashMap<string, VSchool>; // static
    juniorMap: HashMap<string, VSchool>; // static

    constructor(done: () => void
        , public primary_files: Array<string> = ["pudong_xiaoxue.xlsx", "xuhui_xiaoxue.xlsx"]
        , public junior_files: Array<string> = ["pudong_zhongxue.xlsx"]
    ) {
        this.primaryMap = new HashMap<string, VSchool>();
        this.juniorMap = new HashMap<string, VSchool>();

        this.loadSchoolFromExcel(done);
    }

    private loadSchoolFromExcel(done: () => void) {
        let waits = Vasync.createAWaitAll(2, done);

        this.loopFiles(this.primary_files, 0, this.primaryMap, waits[0]);
        this.loopFiles(this.junior_files, 0, this.juniorMap, waits[1]);
    }

    private loopFiles(files: Array<string>, curIdx: number, map: HashMap<string, VSchool>, waitObj: Vasync.VSyncObj) {
        if (curIdx < files.length) {
            this.readAndMarkFromExcel(files[curIdx], map, () => {
                this.loopFiles(files, curIdx + 1, map, waitObj);
            });
        } else {
            waitObj.FinishFunc();
        }
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
}
import * as Excel from 'exceljs';
import HashMap = require("hashmap");
import * as SS from "./VStaticStrings";
import { Vasync } from "./async";
import VInfoManager from "./VInfoManager";
import request from "sync-request"; 

export enum VEDataType {
    KEEP_OLD,
    DOWN_PRIZE,
    UP_PRIZE,
    SELLED,
    DISAPPER,
}

export var VEFontColor = ["FF000000", "FF00FF00", "FFFF0000", "FF000000", "FF000000"];
export var VEBkgColor = ["FFFFFFFF", "FFFFFFFF", "FFFFFFFF", "FF00FF00", "FF7F7F7F"];

export class VHouse {
    url: string;
    cellname: string;
    region: string;
    prize: number;
    size: number;
    floorAndYear: string;
    circleRegion: string;
    shapeURI: string;

    constructor() { }

    loadFromExcelRow(row: Excel.Row) {
        this.url = row.getCell(1).value.toString();
        this.cellname = row.getCell(2).value.toString();
        this.region = row.getCell(3).value.toString();
        this.prize = Number(row.getCell(4).value.toString());
        this.size = Number(row.getCell(6).value.toString());
        this.floorAndYear = row.getCell(8).value.toString();
        this.circleRegion = row.getCell(9).value.toString();
        this.shapeURI = row.getCell(13).value.toString();
    }
}

export class VHouseUpdater {
    constructor() { }

    static UpdateHouse(oldHouse: VHouse): VEDataType {
        //request("")

        return VEDataType.KEEP_OLD;
    }
}

export class VDataManager {
    datas: HashMap<string, [VHouse, VEDataType]>;
    dataFile: string;

    constructor() {
        this.datas = new HashMap<string, [VHouse, VEDataType]>();
        this.dataFile = "result.xlsx";
    }

    loadFromExcel(done: () => void) {
        let workbook = new Excel.Workbook();
        workbook.xlsx.readFile(SS.OneDriveHouseFolder + this.dataFile).then(() => {
            let sheet = workbook.getWorksheet("Sheet1");
            for (let i = 2; i <= sheet.rowCount; i++) {
                let row = sheet.getRow(i);
                let house = new VHouse();
                house.loadFromExcelRow(row);
                this.datas.set(house.url, [house, VHouseUpdater.UpdateHouse(house)]);
            }
            done();
        }).catch(() => {
            done();
        });
    }

    saveToExcel(infoMngr: VInfoManager, done: () => void) {
        let workbook = new Excel.Workbook();
        let sheet = workbook.addWorksheet("Sheet1");
        let fisrtRow = ["URL", "小区", "区域", "总价", "首付", "平米", "单价", "楼层年代", "环", "小学", "中学", "地铁", "户型图"];
        sheet.addRow(fisrtRow);

        let rowCurIdx = 1;
        this.datas.forEach((val: [VHouse, VEDataType], key: string) => {
            let primarySchool = infoMngr.primaryMap.get(val[0].cellname).name;
            let juniorSchool = infoMngr.juniorMap.get(val[0].cellname).name;
            let metros = infoMngr.metroMap.get(val[0].cellname);
            let metroStr = "";
            for (let i = 0; i < metros.length; i++) {
                if (metros[i].walkDis < 1000) {
                    metroStr += metros[i].name + ":" + metros[i].walkDis + ",";
                }
            }
            
            let newRow = sheet.addRow([{
                text: val[0].url,
                hyperlink: val[0].url
            }, val[0].cellname, val[0].region, val[0].prize, val[0].prize * 0.35, val[0].size, val[0].prize / val[0].size, val[0].floorAndYear, val[0].circleRegion, primarySchool, juniorSchool, metroStr, val[0].shapeURI]);
            newRow.height = 120;
            newRow.fill = {
                type: 'pattern',
                pattern: 'none',
                fgColor: { argb: VEFontColor[val[1]] },
                bgColor: { argb: VEBkgColor[val[1]] }
            };

            let houseImgId = workbook.addImage({ base64: val[0].shapeURI, extension: 'jpeg' });
            sheet.addImage(houseImgId, {
                tl: { col: fisrtRow.length - 1, row: rowCurIdx },
                br: { col: fisrtRow.length, row: rowCurIdx + 1 }
            });
            rowCurIdx += 1;
        });

        sheet.getColumn(fisrtRow.length - 1).width = 20;

        workbook.xlsx.writeFile(SS.OneDriveHouseFolder + this.dataFile).then(done);
    }
}

export default VDataManager;
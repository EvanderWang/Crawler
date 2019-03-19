import * as Excel from 'exceljs';
import HashMap = require("hashmap");
import * as SS from "./VStaticStrings";
import { Vasync } from "./async";
import { VMetroInfoManager } from "./VMetroInfoManager";
import { VSchoolInfoManager } from "./VSchoolInfoManager";
import * as cheerio from "cheerio";
import request from "sync-request";
import * as asyncrequest from "request";
import * as base64 from "base-64";

export enum VEDataType {
    NEW,
    KEEP_OLD,
    DOWN_PRIZE,
    UP_PRIZE,
    SELLED,
    DISAPPER,
}

export class VSDataChange {
    constructor(public type: VEDataType = VEDataType.NEW, public value: number = 0) { }
}

export var VETypeStr = ["新 : ", "旧 : ", "跌 : ", "涨 : ", "售 : ", "下 : "];
//export var VEFontColor = ["FFFFFF00", "FF000000", "FF00FF00", "FFFF0000", "FF000000", "FF000000"];
export var VEBkgColor = ["FF00A8ED", "FFFFFFFF", "FFFFFFFF", "FFFFFFFF", "FF00FF00", "FF7F7F7F"];

export enum VEExportInfoType {
    URL,
    CELLNAME,
    REGION,
    PRIZE,
    FIRST_PRIZE,
    SIZE,
    PRIZE_PER_SIZE,
    FLOOR_AND_YEAR,
    PRIMARY_SCHOOL,
    JUNIOR_SCHOOL,
    METRO,
    SHAPE_URI,
    CHANGE,
}

var g_fisrtRow = ["URL", "小区", "区域", "总价", "首付", "平米", "单价", "楼层年代", "小学", "中学", "地铁", "户型图", "变动"];

export class VHouse {
    url: string;
    cellname: string;
    region: string;
    prize: number;
    size: number;
    floorAndYear: string;
    shapeURI: string;

    constructor() { }

    loadFromExcelRow(row: Excel.Row) {
        this.url = row.getCell(VEExportInfoType.URL + 1).value.toString();
        this.cellname = row.getCell(VEExportInfoType.CELLNAME + 1).value.toString();
        this.region = row.getCell(VEExportInfoType.REGION + 1).value.toString();
        this.prize = Number(row.getCell(VEExportInfoType.PRIZE + 1).value.toString());
        this.size = Number(row.getCell(VEExportInfoType.SIZE + 1).value.toString());
        this.floorAndYear = row.getCell(VEExportInfoType.FLOOR_AND_YEAR + 1).value.toString();
        this.shapeURI = row.getCell(VEExportInfoType.SHAPE_URI + 1).value.toString();
    }

    loadFromPage(pageurl: string, page$: CheerioStatic) {
        this.url = pageurl;
        let view = page$('.overview');
        let img = view.children('.img');
        let content = view.children('.content');

        this.cellname = content.children('.aroundInfo').children('.communityName').children('.info ').text();
        this.region = content.children('.aroundInfo').children('.areaName').children('.info').text();
        this.prize = Number(content.children('.price ').children('.total').text());
        let sizeStr = content.children('.houseInfo').children('.area').children('.mainInfo').text();
        this.size = Number(sizeStr.slice(0, sizeStr.length - 2));
        this.floorAndYear = content.children('.houseInfo').children('.area').children('.subInfo').text() + "\n" + content.children('.houseInfo').children('.room').children('.subInfo').text();

        this.shapeURI = img.children('.thumbnail').children('.smallpic').children('li[data-desc="户型图"]').data("pic");
    }
}

export class VHouseUpdater {
    constructor() { }

    static UpdateHouse(house: VHouse): VSDataChange {
        let page$ = cheerio.load(request("GET", house.url).getBody());

        let sellDetail = page$('.sellDetailHeader');
        if (sellDetail) {
            let przRm = page$('.price isRemove');
            if (przRm) {
                return new VSDataChange(VEDataType.DISAPPER, Number(przRm.children('.total').text()));
            } else {
                let view = page$('.overview');
                let content = view.children('.content');
                let prize = Number(content.children('.price ').children('.total').text());

                if (prize == house.prize) {
                    return new VSDataChange(VEDataType.KEEP_OLD, 0);
                } else if (prize > house.prize) {
                    return new VSDataChange(VEDataType.UP_PRIZE, prize - house.prize);
                } else {
                    return new VSDataChange(VEDataType.DOWN_PRIZE, prize - house.prize);
                }
            }
        } else {
            let dpStr = page$('.dealTotalPrice').text();
            let dp = Number(dpStr.slice(0, dpStr.length - 1));
            return new VSDataChange(VEDataType.SELLED, dp);
        }
    }
}

export class VDataManager {
    datas: HashMap<string, [VHouse, VSDataChange]>;

    constructor(done: () => void, public dataFile: string = "result.xlsx") {
        this.datas = new HashMap<string, [VHouse, VSDataChange]>();
        this.loadFromExcel(done);
    }

    private loadFromExcel(done: () => void) {
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

    saveToExcel(miMngr: VMetroInfoManager, siMngr: VSchoolInfoManager, done: () => void) {
        let workbook = new Excel.Workbook();
        let sheet = workbook.addWorksheet("Sheet1");
        sheet.addRow(g_fisrtRow);

        let rowCurIdx = 1;

        let keys = this.datas.keys();
        let waits = Vasync.createAWaitAll(keys.length, () => {
            sheet.getColumn(VEExportInfoType.SHAPE_URI + 1).width = 33;
            sheet.getColumn(VEExportInfoType.METRO + 1).width = 20;
            sheet.getColumn(VEExportInfoType.FLOOR_AND_YEAR + 1).width = 16;
            sheet.getColumn(VEExportInfoType.REGION + 1).width = 25;
            sheet.getColumn(VEExportInfoType.CELLNAME + 1).width = 15;
            workbook.xlsx.writeFile(SS.OneDriveHouseFolder + this.dataFile).then(done);
        });
        for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
            let val = this.datas.get(keys[keyIdx]);

            let primarySchool = siMngr.primaryMap.has(val[0].cellname) ? siMngr.primaryMap.get(val[0].cellname).name : "unknown";
            let juniorSchool = siMngr.juniorMap.has(val[0].cellname) ? siMngr.juniorMap.get(val[0].cellname).name : "unknown";
            let metros = miMngr.metroMap.get(val[0].cellname);
            let metroStr = "";
            if (metros && metros.length > 0) {
                metroStr += metros[0].name + ":" + metros[0].walkDis;
                for (let i = 1; i < metros.length; i++) {
                    if (metros[i].walkDis < 1500) {
                        metroStr += "\n" + metros[i].name + ":" + metros[i].walkDis;
                    }
                }
            }

            let newRow = sheet.addRow([{
                text: val[0].url,
                hyperlink: val[0].url
            }
                , val[0].cellname
                , val[0].region
                , val[0].prize
                , val[0].prize * 0.35
                , val[0].size
                , val[0].prize / val[0].size
                , val[0].floorAndYear
                , primarySchool
                , juniorSchool
                , metroStr
                , val[0].shapeURI ? val[0].shapeURI : "无"
                , VETypeStr[val[1].type] + val[1].value
            ]);
            newRow.height = 96;
            newRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: VEBkgColor[val[1].type] },
            };
            //newRow.font.color = { argb: VEFontColor[val[1].type] };
            newRow.alignment = { vertical: 'middle', horizontal: 'center' }

            let option = {
                tl: { col: VEExportInfoType.SHAPE_URI, row: rowCurIdx },
                br: { col: VEExportInfoType.SHAPE_URI + 1, row: rowCurIdx + 1 },
                editAs: 'oneCell'
            }
            let waitObj = waits[keyIdx];

            if (val[0].shapeURI) {
                asyncrequest(val[0].shapeURI, { encoding: null }, (error: any, response: any, body: any) => {
                    if (!error && response.statusCode == 200) {
                        let base64Data = "data:image/jpeg;base64," + Buffer.from(body).toString('base64');
                        let houseImgId = workbook.addImage({ base64: base64Data, extension: 'jpeg' });
                        sheet.addImage(houseImgId, option);
                    }
                    waitObj.FinishFunc();
                });
            } else {
                waitObj.FinishFunc();
            }
            rowCurIdx += 1;
        }
        
        
    }
}
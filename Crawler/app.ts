import request from "sync-request";
import * as asyncrequest from "request";
import * as cheerio from "cheerio";
import xlsx from 'node-xlsx'; 
import * as fs from "fs";
import * as FormData from 'form-data';

let totalmarkcount = 0;

let refuseSquare = 45;
let maxPrize = 300;
let minPrize = 200;
let checkSchool = false;

class VSchoolList {
    constructor(public keywords: Array<string>) { }
}

class VSubRegion {
    constructor(public urlpart: string, public name: string) { }
}

class VSearchSubReigonList {
    constructor(public subreigons: Array<VSubRegion>) { }
}

class VHouseSchoolMapping {
    mapxlsx: { name: string, data: Array<Array<string>> };
    constructor(xlsfile: string) {
        this.mapxlsx = xlsx.parse(xlsfile)[0];
    }
}

class VSchoolInfo {
    constructor(public l1: VSchoolList
        , public l2: VSchoolList
        , public map: VHouseSchoolMapping
    ) {}
}

class VRegion {
    constructor(public name: string
        , public ssr: VSearchSubReigonList
        , public primary: VSchoolInfo
        , public junior: VSchoolInfo | null
    ) { }
}

class VSchoolFindResult {
    needMark: boolean;
    schoolName: string;
    schoolLevel: string;
}

class VAsyncSearcher {
    url_basepart: string = 'https://sh.lianjia.com/ershoufang/';
    url_pagepart: string = '/pg'
    //url_conditionpart: string = 'l2bp200ep400/';

    constructor(private url_conditionpart: string) { }

    searchRegion(region: VRegion, suc: (data: Array<Array<string>>) => void) {
        console.log("start search region : " + region.name);
        let rtValue = new Array<Array<string>>();
        let curidx = 0;

        let backcount = 0;
        let search = () => {
            let i = curidx;
            curidx += 1;

            this.searchSubRegion(region.ssr.subreigons[i], region.primary, region.junior, (data: Array<Array<string>>) => {
                rtValue = rtValue.concat(data);

                backcount += 1;
                if (backcount == region.ssr.subreigons.length) {
                    suc(rtValue);
                } else {
                    search();
                }
            });
        }
        search();
    }

    searchSubRegion(sr: VSubRegion, primary: VSchoolInfo, junior: VSchoolInfo | null, suc: (data: Array<Array<string>>) => void) {
        console.log("start search sub region : " + sr.name);
        let rtValue = new Array<Array<string>>();
       
        let listpage = request("GET", this.url_basepart + sr.urlpart + '/' + this.url_conditionpart);
        let listpagebody = (<Buffer>listpage.getBody()).toString();

        let findidx = listpagebody.indexOf('"total fl"');
        let countsidx = listpagebody.indexOf('<span>', findidx) + 6;
        let counteidx = listpagebody.indexOf('</span>', findidx);
        let count = Number(listpagebody.substr(countsidx, counteidx - countsidx).trim());

        let pagecount = 0;
        if (count != 0) {
            pagecount = Math.ceil(count / 30);
        }

        if (pagecount == 0) {
            suc(rtValue);
        }

        //let finishpagecount = 0;
        //let pagefinish = (data: Array<Array<string>>) => {
        //    rtValue = rtValue.concat(data);
        //    finishpagecount += 1;
        //    if (finishpagecount == pagecount) {
        //        suc(rtValue);
        //    }
        //}
        //
        //for (let i = 1; i <= pagecount; i++) {
        //    console.log("start search sub region " + sr.name + " page : " + i.toString());
        //    this.searchPage(i, sr, primary, junior, pagefinish);
        //}

        let curidx = 0;
        let backcount = 0;
        let search = () => {
            curidx += 1;
            let i = curidx;
            console.log("start search sub region " + sr.name + " page : " + i.toString());
        
            this.searchPage(i, sr, primary, junior, (data: Array<Array<string>>) => {
                backcount += 1;
                rtValue = rtValue.concat(data);
                if (backcount == pagecount) {
                    suc(rtValue);
                } else {
                    search();
                }
            });
        }
        search();
    }

    private searchPage(pagenumber: number, sr: VSubRegion, primary: VSchoolInfo, junior: VSchoolInfo | null, suc: (data: Array<Array<string>>) => void) {
        let rtValue = new Array<Array<string>>();

        let trycount = 0;
        let markcount = 0;

        asyncrequest(this.url_basepart + sr.urlpart + this.url_pagepart + pagenumber.toString() + this.url_conditionpart, (error: any, response: any, body: any) => {
            if (!error && response.statusCode == 200) {
                let listpagebody = body;
                let listpage$ = cheerio.load(listpagebody);
                let v = listpage$('.sellListContent');
                let houses = v.children();
                let housescount = houses.length;

                let finishhousecount = 0;
                for (let i = 0; i < houses.length; i++) {
                    this.trymarkHouse(houses[i], listpage$, sr.name, primary, junior, (data: Array<string> | null) => {
                        if (data) {
                            markcount += 1;
                            console.log(sr.name + " page " + pagenumber + " finish mark : " + markcount.toString());
                            rtValue.push(data);
                        }
                        trycount += 1;
                        console.log(sr.name + " page " + pagenumber + " finish try : " + trycount.toString());

                        finishhousecount += 1;
                        if (finishhousecount == housescount) {
                            suc(rtValue);
                        }
                    });
                }
            } else {
                suc(rtValue);
            }
        });
    }

    private trymarkHouse(house: cheerio.Element, listpage$: cheerio.Static, srname: string, primary: VSchoolInfo, junior: VSchoolInfo | null, suc: (data: Array<string> | null) => void) {
        let rtValue: Array<string> | null = null;

        let xiaoquurl = house.children[1].children[1].children[0].children[1].attribs["href"];
        let xiaoquName = listpage$(house.children[1].children[1].children[0].children[1]).text();
        let detailurl = house.children[0].attribs["href"];

        asyncrequest(xiaoquurl, (error: any, response: any, body: any) => {
            if (!error && response.statusCode == 200) {
                let xiaoqupagebody = body;
                let xiaoqupage$ = cheerio.load(xiaoqupagebody);
                let xiaoquLocationStr = xiaoqupage$('.detailDesc').text();
                let xiaoquLocations = xiaoquLocationStr.split(',');
                for (let i = 0; i < xiaoquLocations.length; i++) {
                    let b = xiaoquLocations[i].lastIndexOf(")");
                    let loc = xiaoquLocations[i].substr(b + 1, xiaoquLocations[i].length - b - 1);
                    xiaoquLocations[i] = loc;
                }

                let primaryResult: VSchoolFindResult = this.findSchool(xiaoquName, xiaoquLocations, primary);
                let juniorResult: VSchoolFindResult | null = null;
                if (junior) {
                    juniorResult = this.findSchool(xiaoquName, xiaoquLocations, junior);
                }

                if (checkSchool) {
                    if (primaryResult.needMark) {
                        rtValue = this.markHouse(house, listpage$, srname, primaryResult, juniorResult);
                    }
                } else {
                    rtValue = this.markHouse(house, listpage$, srname, primaryResult, juniorResult);
                }

                suc(rtValue);
            } else {
                suc(rtValue);
            }
        });
    }

    private markHouse(house: cheerio.Element, listpage$: cheerio.Static, srname: string, primaryResult: VSchoolFindResult, juniorResult: VSchoolFindResult | null): Array<string> | null {
        let detailurl = house.children[0].attribs["href"];
        let xiaoquname = listpage$(house.children[1].children[1].children[0].children[1]).text();
        let price = listpage$(house.children[1].children[5].children[0].children[0]).text();
        let houseinfo = listpage$(house.children[1].children[1].children[0]).text();
        let houseinfos = houseinfo.split('|');
        let size = "没找到";
        for (let i = 0; i < houseinfos.length; i++) {
            if (houseinfos[i].indexOf("平米") != -1) {
                size = houseinfos[i].substr(0, houseinfos[i].indexOf("平米"));
                break;
            }
        }
        if (Number(size) < refuseSquare) {
            return null;
        }

        let levelinfo = listpage$(house.children[1].children[2].children[0]).text();
        let levelinfos = levelinfo.split('-');
        let level = levelinfos[0];

        totalmarkcount += 1;
        return [xiaoquname, srname, price, (Number(price) * 0.35).toFixed(2), size, (Number(price) / Number(size)).toFixed(3), level, primaryResult.schoolName, primaryResult.schoolLevel, juniorResult ? juniorResult.schoolName : "unknown", juniorResult ? juniorResult.schoolLevel : "unknown", detailurl];
    }

    private findSchool(xiaoquName: string, xiaoquLocations: string[], si: VSchoolInfo): VSchoolFindResult {
        let rtValue = new VSchoolFindResult();
        let school = "";

        for (let i = 0; i < xiaoquLocations.length; i++) {
            let xiaoquLoc = xiaoquLocations[i];
            school = this.tryGetSchool(xiaoquLoc, si.map);
            if (school != "") {
                break;
            }
        }
        if (school == "") {
            school = this.tryGetSchool(xiaoquName, si.map);
        }

        if (school != "") {
            rtValue.needMark = true;
            rtValue.schoolName = school;
            if (this.checkSchoolInList(school, si.l1)) {
                rtValue.schoolLevel = "一梯队";
            } else if (this.checkSchoolInList(school, si.l2)) {
                rtValue.schoolLevel = "二梯队";
            } else {
                rtValue.needMark = false;
                rtValue.schoolLevel = "未列入";
            }
        } else {
            rtValue.needMark = false;
            rtValue.schoolName = "unknown";
            rtValue.schoolLevel = "unknown";
        }

        return rtValue;
    }

    private tryGetSchool(roadorname: string, mapping: VHouseSchoolMapping): string {
        for (let i = 1; i < mapping.mapxlsx.data.length; i++) {
            if (mapping.mapxlsx.data[i][5] == roadorname || mapping.mapxlsx.data[i][6] == roadorname) {
                return mapping.mapxlsx.data[i][3];
            }
        }
        return "";
    }

    private checkSchoolInList(schoolname: string, list: VSchoolList): boolean {
        for (let i = 0; i < list.keywords.length; i++) {
            if (schoolname.indexOf(list.keywords[i]) != -1) {
                return true;
            }
        }
        return false;
    }
}

class VSyncSearcher {
    url_basepart: string = 'https://sh.lianjia.com/ershoufang/';
    url_pagepart: string = '/pg'
    //url_conditionpart: string = 'l2bp200ep400/';

    constructor(private url_conditionpart: string) { }

    searchReigon(region: VRegion): Array<Array<string>> {
        console.log("start search region : " + region.name);
        let rtValue = new Array<Array<string>>();
        for (let i = 0; i < region.ssr.subreigons.length; i++) {
            rtValue = rtValue.concat(this.searchSubRegion(region.ssr.subreigons[i], region.primary, region.junior));
        }
        return rtValue;
    }

    searchSubRegion(sr: VSubRegion, primary: VSchoolInfo, junior: VSchoolInfo | null): Array<Array<string>> {
        console.log("start search sub region : " + sr.name);
        let rtValue = new Array<Array<string>>();
        let curpage = 1;
        let trycount = 0;
        let markcount = 0;
        let flag_continue = true;

        while (flag_continue) {
            console.log("start search sub region page : " + curpage.toString());

            let listpage = request("GET", this.url_basepart + sr.urlpart + this.url_pagepart + curpage.toString() + this.url_conditionpart);
            let listpagebody = (<Buffer>listpage.getBody()).toString();

            let findidx = listpagebody.indexOf('"total fl"');
            let countsidx = listpagebody.indexOf('<span>', findidx) + 6;
            let counteidx = listpagebody.indexOf('</span>', findidx);
            let count = Number(listpagebody.substr(countsidx, counteidx - countsidx).trim());

            let pagecount = 0;
            if (count != 0) {
                pagecount = Math.floor(count / 30) + 1;
            }

            if (pagecount == 0) {
                return rtValue;
            }

            let listpage$ = cheerio.load(listpagebody);
            let v = listpage$('.sellListContent');
            let houses = v.children();
            for (let i = 0; i < houses.length; i++) {
                let houseResult = this.trymarkHouse(houses[i], listpage$, sr.name, primary, junior);
                if (houseResult) {
                    markcount += 1;
                    console.log("finish mark : " + markcount.toString());
                    rtValue.push(houseResult);
                }

                trycount += 1;
                console.log("finish try : " + trycount.toString());
            }

            curpage += 1;
            if (curpage > pagecount) {
                flag_continue = false;
            }
        }

        return rtValue;
    }

    private trymarkHouse(house: cheerio.Element, listpage$: cheerio.Static, srname: string, primary: VSchoolInfo, junior: VSchoolInfo | null): Array<string> | null {
        let rtValue: Array<string> | null = null;

        let xiaoquurl = house.children[1].children[1].children[0].children[1].attribs["href"];
        let xiaoquName = listpage$(house.children[1].children[1].children[0].children[1]).text();
        let detailurl = house.children[0].attribs["href"];

        let xiaoqupage = request("GET", xiaoquurl);
        let xiaoqupagebody = (<Buffer>xiaoqupage.getBody()).toString();

        let xiaoqupage$ = cheerio.load(xiaoqupagebody);
        let xiaoquLocationStr = xiaoqupage$('.detailDesc').text();
        let xiaoquLocations = xiaoquLocationStr.split(',');
        for (let i = 0; i < xiaoquLocations.length; i++) {
            let b = xiaoquLocations[i].lastIndexOf(")");
            let loc = xiaoquLocations[i].substr(b + 1, xiaoquLocations[i].length - b - 1);
            xiaoquLocations[i] = loc;
        }

        let primaryResult: VSchoolFindResult = this.findSchool(xiaoquName, xiaoquLocations, primary);
        let juniorResult: VSchoolFindResult | null = null;
        if (junior) {
            juniorResult = this.findSchool(xiaoquName, xiaoquLocations, junior);
        }

        if (checkSchool) {
            if (primaryResult.needMark) {
                rtValue = this.markHouse(house, listpage$, srname, primaryResult, juniorResult);
            }
        } else {
            rtValue = this.markHouse(house, listpage$, srname, primaryResult, juniorResult);
        }

        return rtValue;
    }

    private markHouse(house: cheerio.Element, listpage$: cheerio.Static, srname: string, primaryResult: VSchoolFindResult, juniorResult: VSchoolFindResult | null): Array<string> | null {
        let detailurl = house.children[0].attribs["href"];
        let xiaoquname = listpage$(house.children[1].children[1].children[0].children[1]).text();
        let price = listpage$(house.children[1].children[5].children[0].children[0]).text();
        let houseinfo = listpage$(house.children[1].children[1].children[0]).text();
        let houseinfos = houseinfo.split('|');
        let size = "没找到";
        for (let i = 0; i < houseinfos.length; i++) {
            if (houseinfos[i].indexOf("平米") != -1) {
                size = houseinfos[i];
                break;
            }
        }
        if (Number(size) < refuseSquare) {
            return null;
        }

        let levelinfo = listpage$(house.children[1].children[2].children[0]).text();
        let levelinfos = levelinfo.split('-');
        let level = levelinfos[0];

        totalmarkcount += 1;
        return [xiaoquname, srname, price, (Number(price) * 0.35).toFixed(2), size, (Number(price) / Number(size)).toFixed(3), level, primaryResult.schoolName, primaryResult.schoolLevel, juniorResult ? juniorResult.schoolName : "unknown", juniorResult ? juniorResult.schoolLevel : "unknown", detailurl];
    }

    private findSchool(xiaoquName: string, xiaoquLocations: string[], si: VSchoolInfo): VSchoolFindResult {
        let rtValue = new VSchoolFindResult();
        let school = "";

        for (let i = 0; i < xiaoquLocations.length; i++) {
            let xiaoquLoc = xiaoquLocations[i];
            school = this.tryGetSchool(xiaoquLoc, si.map);
            if (school != "") {
                break;
            }
        }
        if (school == "") {
            school = this.tryGetSchool(xiaoquName, si.map);
        }

        if (school != "") {
            rtValue.needMark = true;
            rtValue.schoolName = school;
            if (this.checkSchoolInList(school, si.l1)) {
                rtValue.schoolLevel = "一梯队";
            } else if (this.checkSchoolInList(school, si.l2)){
                rtValue.schoolLevel = "二梯队";
            } else {
                rtValue.needMark = false;
                rtValue.schoolLevel = "未列入";
            }
        } else {
            rtValue.needMark = false;
            rtValue.schoolName = "unknown";
            rtValue.schoolLevel = "unknown";
        }

        return rtValue;
    }

    private tryGetSchool(roadorname: string, mapping: VHouseSchoolMapping): string {
        for (let i = 1; i < mapping.mapxlsx.data.length; i++) {
            if (mapping.mapxlsx.data[i][5] == roadorname || mapping.mapxlsx.data[i][6] == roadorname) {
                return mapping.mapxlsx.data[i][3];
            }
        }
        return "";
    }

    private checkSchoolInList(schoolname: string, list: VSchoolList): boolean {
        for (let i = 0; i < list.keywords.length; i++) {
            if (schoolname.indexOf(list.keywords[i]) != -1) {
                return true;
            }
        }
        return false;
    }
}

class VExporter {
    condition: string = 'bp' + minPrize + 'ep' + maxPrize + '/';
    filteredSheets: Array<{ name: string, data: Array<Array<string>> }>;

    constructor(public export_file: string, public regions: Array<VRegion>) {
        this.filteredSheets = new Array<{ name: string, data: Array<Array<string>> }>();

        for (let i = 0; i < regions.length; i++) {
            let filtered = new Array<Array<string>>();
            filtered.push(["小区名称", "区域", "总价", "首付", "平米", "单价", "楼层年代", "对口小学", "小学等级", "对口中学", "中学等级", "网页地址"]);
            this.filteredSheets.push({ name: regions[i].name, data: filtered });
        }

        this.asyncbuild();
    }

    private syncbuild() {
        let searcher = new VSyncSearcher(this.condition);
        for (let i = 0; i < this.regions.length; i++) {
            let searchResult = searcher.searchReigon(this.regions[i]);
            this.filteredSheets[i].data = this.filteredSheets[i].data.concat(searchResult);
        }
        this.export();
    }

    private asyncbuild() {
        let searcher = new VAsyncSearcher(this.condition);
        let curidx = 0;

        let finishcount = 0;
        let dosearch = () => {
            if (curidx < this.regions.length) {
                let i = curidx;
                curidx += 1;
                searcher.searchRegion(this.regions[i], (searchResult: Array<Array<string>>) => {
                    this.filteredSheets[i].data = this.filteredSheets[i].data.concat(searchResult);
                    finishcount += 1;
                    if (finishcount == this.regions.length) {
                        this.export();
                    }
                    dosearch();
                })
            }
        }
        dosearch();
    }

    private export() {
        console.log("export total count = " + totalmarkcount);
        let buffer = xlsx.build(this.filteredSheets);
        fs.writeFileSync(this.export_file, buffer);
    }
}

class VJustSchoolExporter {
    condition: string = '/';
    filteredSheets: Array<Array<{ name: string, data: Array<Array<string>> }>>;

    constructor(public export_file: string, public regions: Array<VRegion>) {
        this.filteredSheets = new Array<Array<{ name: string, data: Array<Array<string>> }>>();

        for (let i = 0; i < regions.length; i++) {
            let subregion = new Array<{ name: string, data: Array<Array<string>> }>();
            for (let j = 0; j < regions[i].ssr.subreigons.length; j++) {
                let filtered = new Array<Array<string>>();
                filtered.push(["小区名称", "区域", "总价", "首付", "平米", "单价", "楼层年代", "对口小学", "小学等级", "对口中学", "中学等级", "网页地址"]);
                subregion.push({ name: regions[i].ssr.subreigons[j].name, data: filtered });
            }
            this.filteredSheets.push(subregion);
        }

        this.asyncbuild();
    }

    private syncbuild() {
        let searcher = new VSyncSearcher(this.condition);
        for (let i = 0; i < this.regions.length; i++) {
            for (let j = 0; j < this.regions[i].ssr.subreigons.length; j++) {
                let searchResult = searcher.searchSubRegion(this.regions[i].ssr.subreigons[j], this.regions[i].primary, this.regions[i].junior);
                this.filteredSheets[i][j].data = this.filteredSheets[i][j].data.concat(searchResult);
            }
        }
        this.export();
    }

    private asyncbuild() {
        let searcher = new VAsyncSearcher(this.condition);
        let curidx = 0;
        let cursubidx = 0;

        let finishcount = 0;
        let dosearch = () => {
            if (curidx < this.regions.length) {
                let i = curidx;
                let j = cursubidx;
                cursubidx += 1;
                searcher.searchSubRegion(this.regions[i].ssr.subreigons[j], this.regions[i].primary, this.regions[i].junior, (searchResult: Array<Array<string>>) => {
                    this.filteredSheets[i][j].data = this.filteredSheets[i][j].data.concat(searchResult);
                    if (cursubidx == this.regions[i].ssr.subreigons.length) {
                        curidx += 1;
                        cursubidx = 0;
                        dosearch();
                    } else {
                        dosearch();
                    }
                })
            } else {
                this.export();
            }
        }
        dosearch();
    }

    private export() {
        console.log("export total count = " + totalmarkcount);
        let out = new Array<{ name: string, data: Array<Array<string>> }>();
        for (let i = 0; i < this.filteredSheets.length; i++) {
            for (let j = 0; j < this.filteredSheets[i].length; j++) {
                out.push(this.filteredSheets[i][j]);
            }
        }

        let buffer = xlsx.build(out);
        fs.writeFileSync(this.export_file, buffer);
    }
}

class VRegionBuilder {
    static Build(name: string, buildinfoxlsx: string, pschoolxlsx: string, jschoolxlsx: string | null): VRegion {
        let bi = xlsx.parse(buildinfoxlsx);
        let searchregioninfo: { name: string, data: Array<Array<string>> } = bi[0];
        let pschoolinfo: { name: string, data: Array<Array<string>> } = bi[1];
        let jschoolinfo: { name: string, data: Array<Array<string>> } = bi[2];

        let ssr = this.BuildSubRegion(searchregioninfo);
        let primary = this.BuildSchoolInfo(pschoolinfo, pschoolxlsx);
        let junior: VSchoolInfo | null = null;
        if (jschoolxlsx)
            junior = this.BuildSchoolInfo(jschoolinfo, jschoolxlsx);

        return new VRegion(name, ssr, primary, junior);
    }

    private static BuildSubRegion(info: { name: string, data: Array<Array<string>> }): VSearchSubReigonList {
        let subregionlist = new Array<VSubRegion>();
        for (let i = 1; i < info.data.length; i++) {
            let name = info.data[i][0];
            let urlpart = info.data[i][1];
            subregionlist.push(new VSubRegion(urlpart, name));
        }
        return new VSearchSubReigonList(subregionlist);
    }

    private static BuildSchoolInfo(info: { name: string, data: Array<Array<string>> }, schoolxlsx: string): VSchoolInfo {
        let l1 = this.BuildSchoolList(info, 0);
        let l2 = this.BuildSchoolList(info, 1);
        let map = new VHouseSchoolMapping(schoolxlsx);
        return new VSchoolInfo(l1, l2, map);
    }

    private static BuildSchoolList(info: { name: string, data: Array<Array<string>> }, clm: number): VSchoolList {
        let schoollist = new Array<string>();
        for (let i = 1; i < info.data.length; i++) {
            let name = info.data[i][clm];
            if (name && name != "")
                schoollist.push(name);
        }
        return new VSchoolList(schoollist);
    }
}

let pudongregion = VRegionBuilder.Build("浦东", "D:\\OneDrive\\House\\pudong_build.xlsx", "D:\\OneDrive\\House\\pudong_xiaoxue.xls", "D:\\OneDrive\\House\\pudong_zhongxue.xls");
let xuhuiregion = VRegionBuilder.Build("徐汇", "D:\\OneDrive\\House\\xuhui_build.xlsx", "D:\\OneDrive\\House\\xuhui_xiaoxue.xlsx", null);
let exporter = new VExporter("D:\\result.xlsx", [pudongregion, xuhuiregion]);

// Region with school html page test.

//let beicairegion = new VRegion("北蔡", new VSearchSubReigonList([new VSubRegion("beicai", "北蔡")]), pudongregion.primary, pudongregion.junior);
//let exporter = new VJustSchoolExporter("D:\\result.xlsx", [beicairegion]);

//let fd = new FormData();
//fd.append("show", "community");
//fd.append("p", "1");
//fd.append("key", "泾东小区");
//
//asyncrequest.get("http://www.xingdd.com/community/searchCommunities", { form: fd }, (error: any, response: any, body: any) => {
//    let i = 0;
//});
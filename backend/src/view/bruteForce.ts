import { Chart } from "@/types/Song"
import { Card, Stat, statSum, mulStat, addStat } from "@/types/Card"
import { AreaItemType } from "@/types/AreaItem"
import { Character } from "@/types/Character"
import { Item } from "@/types/Item"
import { calcResult, print } from "./calcResult"
import { playerDetail } from "@/database/playerDB"
import { Event } from "@/types/Event"
import { Skill, scoreUp } from "@/types/Skill"

export class cardInfo{
    card: Card
    illustTrainingStatus?: boolean
    limitBreakRank?: number
    skillLevel?: number
    stat?: Stat
    eventAddStat?: Stat
    duration?: number
    scoreUp?: scoreUp
    rateup?: boolean
    addUpStat?: number
    constructor(cardId) {
        this.card = new Card(parseInt(cardId))
    }
    async initFull(event: Event, player: playerDetail) {
        const key = this.card.cardId.toString()
        this.illustTrainingStatus = player.cardList[key].illustTrainingStatus,
        this.limitBreakRank = player.cardList[key].limitBreakRank,
        this.skillLevel = player.cardList[key].skillLevel
        this.stat = await this.card.calcStat()
        const add = this.card.rarity * this.limitBreakRank * 50
        addStat(this.stat, {
            performance: add,
            technique: add,
            visual: add
        })
        
        {
            const tmpStat1 = mulStat(this.stat, player.characterBouns[this.card.characterId].potential)
            const tmpStat2 = mulStat(this.stat, player.characterBouns[this.card.characterId].characterTask)
            addStat(this.stat, {
                performance: Math.floor(tmpStat1.performance),
                technique: Math.floor(tmpStat1.technique),
                visual: Math.floor(tmpStat1.visual)
            })
            addStat(this.stat, {
                performance: Math.floor(tmpStat2.performance),
                technique: Math.floor(tmpStat2.technique),
                visual: Math.floor(tmpStat2.visual)
            })
        }

        {
            const tmpStat: Stat = {
                performance: 0,
                technique: 0,
                visual: 0
            }
            var flag: number = 0
            for (const { attribute, percent } of event.attributes) {
                if (attribute == this.card.attribute) {
                    flag |= 1
                    addStat(tmpStat, {
                        performance: percent,
                        technique: percent,
                        visual: percent
                    })
                }
            }
            
            for (const { characterId, percent } of event.characters) {
                if (characterId == this.card.characterId) {
                    flag |= 2
                    addStat(tmpStat, {
                        performance: percent,
                        technique: percent,
                        visual: percent
                    })
                }
            }
            
            for (const { situationId, percent } of event.members) {
                if (situationId == this.card.cardId) {
                    addStat(tmpStat, {
                        performance: percent,
                        technique: percent,
                        visual: percent
                    })
                }
            }

            if (flag == 3) {
                if (Object.keys(event.eventCharacterParameterBonus).length > 0) {
                    //@ts-ignore
                    addStat(tmpStat, event.eventCharacterParameterBonus)
                }
                const percent = event.eventAttributeAndCharacterBonus.parameterPercent
                addStat(tmpStat, {
                    performance: percent,
                    technique: percent,
                    visual: percent
                })
            }

            {
                const percent = event.limitBreaks[this.card.rarity][this.limitBreakRank]
                addStat(tmpStat, {
                    performance: percent,
                    technique: percent,
                    visual: percent
                })
            }

            tmpStat.performance /= 100
            tmpStat.technique /= 100
            tmpStat.visual /= 100
            this.eventAddStat = mulStat(this.stat, tmpStat)
        }

        const skill: Skill = this.card.getSkill()
        this.duration = skill.duration[this.skillLevel - 1]
        this.scoreUp = skill.getScoreUp()
        this.rateup = skill.skillId == 61
    }
    calcStat(areaItem, bandId, attribute, magazine) {
        const tmpStat: Stat = {
            performance: 0,
            technique: 0,
            visual: 0
        }
        if (bandId == '1000' || bandId == this.card.bandId.toString()) {
            addStat(tmpStat, mulStat(this.stat, areaItem[AreaItemType.band][bandId].stat))
        }
        if (attribute == '~all' || attribute == this.card.attribute) {
            addStat(tmpStat, mulStat(this.stat, areaItem[AreaItemType.attribute][attribute].stat))
        }
        addStat(tmpStat, mulStat(this.stat, areaItem[AreaItemType.magazine][magazine].stat))
        addStat(tmpStat, this.stat)
        addStat(tmpStat, this.eventAddStat)
        this.addUpStat = statSum(tmpStat)
    }
}
export class teamInfo{
    set: number
    stat: number
    baseStat: number
    team: Array<cardInfo>
    score: Array<number>
    scoreRate: Array<number>
    order: Array<Array<cardInfo>>
    capital: Array<cardInfo>
    scoreUp: Array<Array<number> >
    meta: Array<number>
    constructor() {
        this.set = 0
        this.stat = 0
        this.baseStat = 0
        this.team = []
        this.score = []
        this.scoreRate = []
        this.order = []
        this.capital = []
        this.scoreUp = []
        this.meta = []
    }
    calcBaseStat() {
        this.baseStat = 0
        let tmpStat: Stat = {
            performance: 0,
            technique: 0,
            visual: 0
        }
        for (const { stat, eventAddStat } of this.team) {
            addStat(tmpStat, stat)
            addStat(tmpStat, eventAddStat)
        }
        this.baseStat = statSum(tmpStat)
    }
    calcStat() {
        this.stat = 0
        for (const { addUpStat } of this.team) {
            this.stat += addUpStat
        }
    }
}

export function bruteForce(charts: Array<Chart>, cardList: Array<cardInfo>, areaItem, type: string) {

    function checkCharacter(team: Array<cardInfo>) {
        const characterSet = new Set()
        for (const info of team) {
            if (characterSet.has(info.card.characterId))
                return false
            characterSet.add(info.card.characterId)
        }
        return true
    }

    function initTeamList(depth: number = 0, Set: number = 0, team: Array<cardInfo> = []) {
        if (depth == 5) {
            if (checkCharacter(team)) {
                const info = new teamInfo()
                info.team = team
                info.set = Set

                let bandId, attribute
                for (const info of team) {
                    if (!bandId) bandId = info.card.bandId
                    if (bandId != info.card.bandId) bandId = 1000

                    if (!attribute) attribute = info.card.attribute
                    if (attribute != info.card.attribute) attribute = '~all'
                }

                const scoreUp = team.map(info => {
                    if (info.scoreUp.unificationActivateEffectValue) {
                        if (info.scoreUp.unificationActivateConditionBandId && info.scoreUp.unificationActivateConditionBandId != bandId)
                            return info.scoreUp.default || 1.45 // 针对 155P 的修复
                        if (info.scoreUp.unificationActivateConditionType && info.scoreUp.unificationActivateConditionType.toLocaleLowerCase() != attribute)
                            return info.scoreUp.default || 1.45 // 针对 155P 的修复
                        // console.log(info.scoreUp.unificationActivateConditionType, attribute)
                        return info.scoreUp.unificationActivateEffectValue
                    }
                    return info.scoreUp.default
                })

                for (var i = 0; i < charts.length; i += 1) {
                    const res = charts[i].getMaxMetaOrder(team, scoreUp)
                    info.order.push(res.team)
                    info.capital.push(res.capital)
                    info.scoreUp.push(res.scoreUp)
                    info.meta.push(res.meta)
                }
                teamList.push(info)
            }
            return
        }
        for (var i = 0; i < cardList.length; i += 1) {
            if (Set >> i & 1) {
                break
            }
            initTeamList(depth + 1, Set | 1 << i, [cardList[i], ...team])
        }
    }
    var data: calcResult = {
        totalScore: 0,
        totalStat: 0,
        score: [],
        stat: [],
        item: {},
        capital: [],
        team : []
    }

    const teamList: Array<teamInfo> = []
    initTeamList()
    console.log(teamList.length)

    // 找到综合力最高的队伍，优先计算其对应基建时的配队
    for (const info of teamList) {
        info.calcBaseStat()
    }
    teamList.sort((a, b) => {
        return b.baseStat - a.baseStat
    })
    const bestTeam = teamList[0]
    let bestTeamStat = 0
    let bestTeamMagazine = 'performance'
    let bestTeamBandId = '1000'
    let bestTeamAttribute = '~all'

    for (var magazine in areaItem[AreaItemType.magazine]) {
        for (var bandId in areaItem[AreaItemType.band]) {
            for (var attribute in areaItem[AreaItemType.attribute]) {
                for (const info of cardList) {
                    info.calcStat(areaItem, bandId, attribute, magazine)
                }
                bestTeam.calcStat()
                if (bestTeamStat < bestTeam.stat) {
                    bestTeamStat = bestTeam.stat
                    bestTeamMagazine = magazine
                    bestTeamBandId = bandId
                    bestTeamAttribute = attribute
                }
            }
        }
    }
    // console.log("max team base stat:", bestTeam.baseStat)
    // console.log("max team stat:", bestTeamStat)
    // console.log("max team magazine:", bestTeamMagazine)
    // console.log("max team bandId:", bestTeamBandId)
    // console.log("max team attribute:", bestTeamAttribute)

    const maxScoreRate = Array.from({ length: charts.length }, () => 0)
    for (const info of teamList) {
        info.scoreRate = charts.map((chart, i) => {
            const scoreRate = chart.getScore([...info.order[i], info.capital[i]], info.scoreUp[i], 500000) / 500000
            if (maxScoreRate[i] < scoreRate)
                maxScoreRate[i] = scoreRate
            return scoreRate
        })
    }

    // let time1 = 0, time2 = 0
    const timeStart = Date.now()

    function main_process(magazine, bandId, attribute) {
        const maxScore = Array.from({ length: charts.length }, () => 0)
        // const st = Date.now()
        for (const info of cardList) {
            info.calcStat(areaItem, bandId, attribute, magazine)
        }

        // 每张卡的综合力从大到小排序，用于剪枝
        const cardListStat = cardList.map((info, i) => {
            return { stat: info.addUpStat, set: 1 << i }
        })
        cardListStat.sort((a, b) => { return b.stat - a.stat })

        let abortSet = 0
        for (let i = 0; i < cardList.length; i++) {
            if (bandId == cardList[i].card.cardId.toString() || attribute == cardList[i].card.attribute) {
                continue
            }

            let cnt = 0, scoreUpMaxValue = cardList[i].scoreUp.unificationActivateEffectValue || cardList[i].scoreUp.default
            for (const info of cardList) {
                if (info.addUpStat > cardList[i].addUpStat && info.scoreUp.default >= scoreUpMaxValue)
                    cnt += 1
            }
            if (cnt >= 5 * charts.length)
                abortSet |= 1 << i
        }
        // console.log(cardList.map(info => info.stat))
        // console.log(cardList.map(info => info.scoreUp.default))
        // console.log(abortSet)

        const tmpTeamList = teamList.filter(info => (info.set & abortSet) == 0)

        for (const info of tmpTeamList) {
            info.calcStat()
            info.score = charts.map((chart, i) => {
                const score = chart.getScore([...info.order[i], info.capital[i]], info.scoreUp[i], Math.floor(info.stat))
                if (maxScore[i] < score)
                    maxScore[i] = score
                return score
            })
        }

        const ed = Date.now()
        // time1 += ed - st
        maxScore.push(0)
        for (var i = charts.length - 1; i >= 0; i -= 1) {
            maxScore[i] += maxScore[i + 1]
        }

        console.log('cur max score =', data.totalScore, "maxScore =", maxScore[0])
        if (maxScore[0] <= data.totalScore) {
            console.log("skip", magazine, bandId, attribute)
            return
        }

        tmpTeamList.sort((a, b) => {
            return b.score.at(-1) - a.score.at(-1)
        })
        // console.log(tmpTeamList.length)
        var cnt = 0
        function dfs(depth: number = 0, Set: number = 0, sumScore: number = 0, teamList: Array<teamInfo> = []) {
            if (depth == 1) {
                const timeNow = Date.now()
                if (timeNow - timeStart > 1200000) {
                    throw new Error()
                }
            }
            if (depth == charts.length) {
                // console.log(sumScore)
                if (sumScore > data.totalScore) {
                    cnt += 1
                    const result = {
                        totalScore: 0,
                        totalStat: 0,
                        score: [],
                        stat: [],
                        team: [],
                        capital: [],
                        item: {}
                    }
                    for (var i = 0; i < charts.length; i += 1) {
                        const info: teamInfo = teamList[i]
                        result.totalStat += info.stat
                        result.score.push(info.score[i])
                        result.stat.push(Math.floor(info.stat))
                        result.team.push(info.order[i])
                        result.capital.push(info.capital[i])
                        // console.log(info.scoreUp[i])
                    }
                    result.totalStat = Math.floor(result.totalStat)
                    result.totalScore = sumScore
                    result.item[AreaItemType.band] = bandId
                    result.item[AreaItemType.attribute] = attribute
                    result.item[AreaItemType.magazine] = magazine
                    data = result
                }
                return
            }
            for (const info of tmpTeamList) {
                if (Set & info.set) {
                    continue
                }
                if (sumScore + info.score[depth] + maxScore[depth + 1] <= data.totalScore) {
                    continue
                }
                // 把剩下的歌曲按照除当前已选队伍外的最高综合力 X 最大可能歌曲技能加成 作为上限
                let maxScore2 = 0
                var maxScoreRates = maxScoreRate.slice(depth + 1)
                maxScoreRates.sort().reverse()
                let teamCount = 0, teamStat = 0
                for (var card of cardListStat) {
                    if (card.set & info.set || card.set & Set) {
                        continue
                    }
                    teamCount += 1
                    teamStat += card.stat
                    if (teamCount == 5) {
                        var scoreRate = maxScoreRates.pop()
                        maxScore2 += Math.floor(scoreRate * teamStat)
                        if (maxScoreRates.length == 0) {
                            break;
                        }
                        teamCount = 0
                        teamStat = 0
                    }
                }
                if (sumScore + info.score[depth] + maxScore2 <= data.totalScore) {
                    // console.log("maxScore2 =", maxScore2, 'data.totalScore =', data.totalScore, 'continue.')
                    continue
                }
                teamList.push(info)
                dfs(depth + 1, Set | info.set, sumScore + info.score[depth], teamList)
                teamList.pop()
                // 我感觉这里不能剪枝？
                // if (depth == charts.length - 1) {
                //     break
                // }
            }
        }
        // const st2 = Date.now()
        dfs()
        // console.log(cnt)
        // const ed2 = Date.now()
        // time2 += ed2 - st2
    }

    main_process(bestTeamMagazine, bestTeamBandId, bestTeamAttribute)
    for (var magazine in areaItem[AreaItemType.magazine]) {
        for (var bandId in areaItem[AreaItemType.band]) {
            for (var attribute in areaItem[AreaItemType.attribute]) {
                if (magazine == bestTeamMagazine && bandId == bestTeamBandId && attribute == bestTeamAttribute) {
                    continue
                }
                main_process(magazine, bandId, attribute)
            }
        }
    }
    // console.log(time1)
    // console.log(time2)
    // data.totalScore = data.score.reduce((pre, cur) => pre + cur, 0)
    return data
}
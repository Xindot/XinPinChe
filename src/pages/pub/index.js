const util = require('../../utils/util')

//获取应用实例
const app = getApp()
const db = app.globalData.db
const Timeout = app.globalData.Timeout
const Tips = app.globalData.Tips

Page({
  data: {
    nowTime: util.formatTime(new Date(), '-:2'),
    YEAR_: new Date().getFullYear() + '-',
    disABrate: app.globalData.disABrate || 0.5,
    pageName: 'pub',
    tripTypes: [{
      label: '人找车',
    }, {
      label: '车找人',
    }],
    myPubList: null,
    selectMyPubIndex: 0,
    matchPubList: null,
    wheel: {
      loader: false 
    }
  },
  onLoad() {
    this.getMyPubList()
  },
  onShow(){
    if (app.globalData.showRefresh){
      this.getMyPubList()
      app.globalData.showRefresh = false
    }
  },
  // 下拉刷新
  onPullDownRefresh(){
    this.getMyPubList()
    setTimeout(()=>{
      wx.stopPullDownRefresh()
    },Timeout.wx.stopPullDownRefresh)
  },
  selectOnePub(e){
    const idx = e.currentTarget.dataset.idx || 0
    this.setData({
      selectMyPubIndex: idx
    })
    this.getMatchPubList(idx)
  },
  // 获取我的行程列表
  getMyPubList() {
    this.setData({
      myPubList: null,
    })
    wx.showLoading({
      title: Tips.wx.showLoading,
    })
    setTimeout(function () {
      wx.hideLoading()
    }, Timeout.wx.hideLoading)
    const WXContext = wx.getStorageSync('WXContext')
    const OPENID = WXContext.OPENID
    db.collection('xpc_pub').where({
      _openid: OPENID,
      status: 1
    }).orderBy('tripTime', 'asc').get().then(res => {
      // console.log(res)
      if (res.data instanceof Array) {
        let myPubList = res.data || []
        myPubList.forEach(n => {
          n.tripTimeShow = n.tripTime.replace(this.data.YEAR_, '')
        })
        const nowTime = util.formatTime(new Date(), '-:2')
        this.setData({
          nowTime,
          myPubList,
        })
        if(myPubList.length>0){
          this.setData({
            selectMyPubIndex: 0
          })
          this.getMatchPubList(0)          
        }else{
          this.getMatchPubList(-1)
        }
      }
      wx.hideLoading()
      wx.stopPullDownRefresh()
    })
  },
  // 获取匹配的行程列表
  getMatchPubList(index){
    this.setData({
      matchPubList: null,
    })
    const _ = db.command
    let query = {
      status: 1,
      tripTime: _.gt(this.data.nowTime),
    }
    let one
    if(index>=0){
      const WXContext = wx.getStorageSync('WXContext')
      const OPENID = WXContext.OPENID
      one = this.data.myPubList[index] || {}
      query = {
        ...query,
        _openid: _.neq(OPENID),
        tripType: Number(one.tripType) === 1 ? 0 : 1,
        'pointA.address': db.RegExp({
          regexp: one.pointA.ssx
        }),
        'pointB.address': db.RegExp({
          regexp: one.pointB.ssx
        })
      }
    }
    wx.showLoading({
      title: Tips.wx.showLoading,
    })
    setTimeout(function () {
      wx.hideLoading()
    }, Timeout.wx.hideLoading)
    // console.log('query=>',query)
    db.collection('xpc_pub').where(query).orderBy('tripTime', 'asc').get().then(res => {
      // console.log(res)
      if(res.data instanceof Array){
        let matchPubList = res.data || []
        matchPubList.forEach(n=>{
          n.disABshow = util.distanceFormat(n.disAB)
          n.tripTimeShow = n.tripTime.replace(this.data.YEAR_, '')

          const disABrate = Number(app.globalData.disABrate) || 0.5

          const disAB = Number(n.disAB)
          if (disAB > 0) {
            n.disABmoneyVary = ((Number(disAB / 1000) * disABrate).toFixed(0))
          }

          if(index>=0){
            n.disAA = util.distanceByLnglat(one.pointA.longitude, one.pointA.latitude, n.pointA.longitude, n.pointA.latitude)
            n.disAAshow = util.distanceFormat(n.disAA)

            n.disBB = util.distanceByLnglat(one.pointB.longitude, one.pointB.latitude, n.pointB.longitude, n.pointB.latitude)
            n.disBBshow = util.distanceFormat(n.disBB)

            const disAABB = Number(n.disAA) + Number(n.disBB)
            // console.log(disAABB)

            if(disAABB>0){
              n.disAABBmoneyVary = ((Number(disAABB / 1000) * disABrate).toFixed(0))
            }
          }
          
        })
        this.setData({
          matchPubList,
        })
      }
      wx.hideLoading()
      wx.stopPullDownRefresh()
    })
  },
  // 行程详情
  targetDetail(e){
    // console.log(e)
    const pid = e.currentTarget.id || null
    const idx = e.currentTarget.dataset.idx || 0
    const openid = e.currentTarget.dataset.openid

    const PubMatchTwo = {
      Me: this.data.myPubList[this.data.selectMyPubIndex] || {},
      Ta: this.data.matchPubList[idx] || {}
    }
    console.log(PubMatchTwo)
    if (PubMatchTwo.Me._id && PubMatchTwo.Ta._id) {
      wx.setStorageSync('PubMatchTwo', PubMatchTwo)
      wx.navigateTo({
        url: 'detail/index'
      })
    }else{
      wx.showModal({
        title: '查看详情，需要先设置行程',
        content: '设置行程可更准确匹配合适的同程',
        success: (res) => {
          if (res.confirm) {
            this.pubMyTrip()
          }
        }
      })
    }
  },
  // 设置我的行程
  pubMyTrip(){
    const WXUserInfo = wx.getStorageSync('WXUserInfo')
    if (WXUserInfo && WXUserInfo.phone && (/^0?(13|14|15|17|18)[0-9]{9}$/.test(WXUserInfo.phone)) ){
      wx.navigateTo({
        url: 'add/index'
      })
    }else{
      wx.showModal({
        title: '设置行程，需要先设置联系方式',
        content: '方便需要的时候能联系到您',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '../me/contact/index'
            })
          }
        }
      })
    }
  },
});



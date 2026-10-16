
var root = '/ad' 
var group = 'wx' 


var config = {
  curUserInfoUrl: `${root}/${group}/user/cur_userinfo`,  // 取当前用户信息
  loginUrl: `${root}/${group}/user/login`,  // 登录
  logoutUrl: `${root}/${group}/user/logout`,  // 退出登录
  getProfileUrl: `${root}/${group}/user/get_profile`,  // 取用户资料
  setProfileUrl: `${root}/${group}/user/set_profile`,  // 保存用户资料
  refreshTokenUrl: `${root}/${group}/user/refresh_token`,  // 刷新token
  updatePasswordUrl: `${root}/${group}/user/update_password`,  //  修改/重置密码
  getIndexInfoUrl: `${root}/${group}/comm/index_info`, // 取首页信息
  addCommUrl: `${root}/${group}/comm/add`,  // 收入录入
  getCommTypesUrl: `${root}/${group}/comm/get_comm_types`,  // 取收入类型
  qryAgencyUrl: `${root}/${group}/comm/qry_agency`,  // 查用户 
  getAgencyUrl: `${root}/${group}/comm/get_agency`,  // 取用户详情 
  saveAgencyUrl: `${root}/${group}/comm/save_agency`,  // 保存用户信息
  qryOrderUrl: `${root}/${group}/comm/qry_order`,  // 查询订单
  sumUnsettleCommUrl: `${root}/${group}/comm/sum_unsettle_comm`,  // 汇总待结金额
  createOrderUrl: `${root}/${group}/comm/create_order`,  // 创建订单
  delOrderUrl: `${root}/${group}/comm/del_order`,  // 删除订单
  qrySettleRecordUrl: `${root}/${group}/comm/get_settle_record`,  // 取订单结算记录
  settleOrderUrl: `${root}/${group}/comm/settle_order`,  // 订单结算
  qryAgencyCommUrl: `${root}/${group}/qry/qry_agency_comm`,  // 查询佣金记录
  exportAgencyCommUrl: `${root}/${group}/qry/export_agency_comm`, // 导出佣金记录
  qryUVDailyUrl: `${root}/${group}/qry/uv_daily`,  // 查询日活
  qryUVUrl: `${root}/${group}/qry/uv`,  // 查询小区日活
  qryDoorUVUrl: `${root}/${group}/qry/door_uv`,  // 查询设备日活
  qryAgencyUVUrl: `${root}/${group}/qry/agency_uv`,  // 查询下级运行账号日活
  takuDailySummaryUrl: `${root}/${group}/taku/daily_summary`,  // Taku收益日汇总
  takuGenCommissionUrl: `${root}/${group}/taku/gen_commission`,  // 生成Taku收益收入并分润
  wxadSyncUrl: `${root}/${group}/wxad/sync`,  // 同步微信流量主数据
  wxadDailySummaryUrl: `${root}/${group}/wxad/daily_summary`,  // 微信流量主收益日汇总
  wxadGenCommissionUrl: `${root}/${group}/wxad/gen_commission`,  // 生成微信流量主收益收入并分润
};

module.exports = config
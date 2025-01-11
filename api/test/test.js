import request from '@/utils/request';

const BASE_API = '/yefiot/v1/test';

export default {
    time() {
        return request({
            url: BASE_API + '/time',
            method: 'get',
        });
    },
};


{/* <template>
    <text>hello</text>
</template>

<script setup>
const { proxy } = getCurrentInstance();

async function test() {
    let res = await proxy.$api.test.time();
    console.log(res);
}
test();
</script>

<style lang="scss" scoped></style> */}
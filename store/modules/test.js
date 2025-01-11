import { defineStore } from 'pinia';

export const useTestStore = defineStore('test', () => {
    const count = ref(0);
    function increment() {
        count.value++;
    }
    return { count, increment };
});


{/* <template>
  <text>{{ count }}</text>
</template>

<script setup>
const { proxy } = getCurrentInstance();
const title = ref('hello');

proxy.$store.test.useTestStore().increment();
const count = proxy.$store.test.useTestStore().count;
</script>

<style lang="scss" scoped></style> */}